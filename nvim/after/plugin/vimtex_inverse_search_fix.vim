" Robust inverse search (Skim ⌘⇧-click → Neovim) for VimTeX.
"
" Skim runs:  nvim --headless -c "VimtexInverseSearch %line '%file'"
" vimtex's global :VimtexInverseSearch broadcasts the click to every registered
" nvim instance, calling vimtex#view#inverse_search in each -- which consults
" b:vimtex of the *focused* buffer only. So a click lands only when the instance
" owning the .tex also has it focused; with several nvim windows open (or when
" you're on a non-tex buffer) it's silently dropped.
"
" We override the COMMAND rather than the receiver function: commands may be
" redefined freely, whereas redefining vimtex's autoload receiver after
" funcref()-capturing it raises E746 (function-name vs script-file check). Our
" command dispatches to our own receiver, which first routes to a buffer/window
" in THIS instance that owns the clicked file, then calls vimtex's own
" (unchanged) jump logic. Non-owning instances fall through vimtex's gate and
" quietly no-op, so exactly the right instance acts. Per-server try/catch also
" fixes the upstream stale-socket abort in s:inverse_search_cmd_nvim.
"
" Lives in after/plugin/ so the command override runs after vimtex's plugin/
" file has defined the original. See ftplugin/tex.lua and lua/user/options.lua
" for the :PDF / forward-search half of this setup.

if exists('g:loaded_vimtex_inverse_search_fix') | finish | endif
let g:loaded_vimtex_inverse_search_fix = 1

" ── receiver: runs in each long-running nvim (invoked via RPC) ─────────────

function! s:project_owns(state, file) abort
  if type(a:state) != v:t_dict | return v:false | endif
  if empty(get(a:state, 'tex', '')) | return v:false | endif   " skip bib/cls states
  if a:state.tex ==# a:file | return v:true | endif
  if !has_key(a:state, 'get_sources') | return v:false | endif
  try
    let l:sources = a:state.get_sources()
  catch
    return v:false
  endtry
  if vimtex#paths#is_abs(a:file)
    call map(l:sources, {_, x -> vimtex#paths#join(a:state.root, x)})
  endif
  return index(l:sources, a:file) >= 0
endfunction

function! s:loaded_buf(state, file) abort
  " Prefer the clicked file's own buffer, else the project's main .tex buffer.
  for l:name in [a:file, get(a:state, 'tex', '')]
    let l:b = empty(l:name) ? -1 : bufnr(l:name)
    if l:b > 0 && bufloaded(l:b) | return l:b | endif
  endfor
  return -1
endfunction

function! s:goto_buf(buf) abort
  if a:buf <= 0 | return | endif
  let l:wins = win_findbuf(a:buf)
  if !empty(l:wins)
    call win_gotoid(l:wins[0])   " win_gotoid crosses tabs too
  else
    execute 'buffer' a:buf
  endif
endfunction

function! s:route(filename) abort
  let l:file = resolve(a:filename)

  " Fast path: focused buffer already owns the file.
  if exists('b:vimtex') && s:project_owns(b:vimtex, l:file) | return v:true | endif

  " A project in this instance owns it (handles subfiles not yet loaded -- we
  " land on the main buffer and let vimtex open the subfile).
  for l:state in vimtex#state#list_all()
    if s:project_owns(l:state, l:file)
      call s:goto_buf(s:loaded_buf(l:state, l:file))
      return v:true
    endif
  endfor

  " Fallback: the file is loaded even though no project claims it.
  let l:b = bufnr(l:file)
  if l:b > 0 && bufloaded(l:b)
    call s:goto_buf(l:b)
    return v:true
  endif

  return v:false
endfunction

" Global so it can be the rpcnotify target. Route to the owning buffer, then
" delegate to vimtex's own inverse_search for the (now correctly-gated) jump.
function! VimtexInverseSearchReceive(line, filename, column) abort
  if !s:route(a:filename) | return | endif
  if exists('*vimtex#view#inverse_search')
    call vimtex#view#inverse_search(a:line, a:filename, a:column)
  endif
endfunction

" ── dispatcher: runs in the headless nvim Skim spawns ──────────────────────

function! s:parse_args(args) abort
  " Mirrors vimtex's plugin/vimtex.vim s:parse_args:
  "   "5 a.tex" -> [5,'a.tex',0]   "5:3 'a.tex'" -> [5,'a.tex',3]
  let l:m = matchlist(a:args, '^\s*\(\d\+\)\%(:\(-\?\d\+\)\)\?\s\+\(.*\)')
  if empty(l:m) | return [-1, '', 0] | endif
  let l:file = substitute(l:m[3], '\v^([''"])(.*)\1\s*', '\2', '')
  if empty(l:file) | return [-1, '', 0] | endif
  return [str2nr(l:m[1]), l:file, str2nr(l:m[2])]
endfunction

function! s:dispatch(line, filename, column) abort
  " Call vimtex#cache#path directly so it autoloads -- exists('*...') would be
  " false at this point (the autoload hasn't been triggered yet) and send us to
  " a wrong fallback path.
  try
    let l:log = vimtex#cache#path('nvim_servernames.log')
  catch
    return
  endtry
  if !filereadable(l:log) | return | endif
  for l:server in readfile(l:log)
    " Per-server try/catch: one dead (or non-participating) instance must not
    " abort delivery to the rest -- this also fixes the upstream stale-socket
    " abort in s:inverse_search_cmd_nvim. rpcrequest is synchronous, so the jump
    " is delivered before the quitall! below (rpcnotify can race the exit).
    try
      let l:ch = sockconnect('pipe', l:server, {'rpc': 1})
      call rpcrequest(l:ch, 'nvim_call_function',
            \ 'VimtexInverseSearchReceive', [a:line, a:filename, a:column])
      call chanclose(l:ch)
    catch
    endtry
  endfor
endfunction

function! s:inverse_search_cmd(args) abort
  " Runs in the Skim-spawned headless nvim, which exits when done -- same
  " contract as vimtex's own command (it also quitall!s unconditionally).
  let [l:line, l:file, l:col] = s:parse_args(a:args)
  if l:line > 0 && !empty(l:file)
    try
      call s:dispatch(l:line, l:file, l:col)
    catch
    endtry
  endif
  quitall!
endfunction

command! -nargs=* VimtexInverseSearch call s:inverse_search_cmd(<q-args>)
