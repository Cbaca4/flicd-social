/** @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { it,expect,vi,afterEach } from 'vitest';
import { fireEvent,screen,cleanup,act } from '@testing-library/react';
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
const render = (ui, options) => renderAccount(ui, 'A', options);
const update=vi.hoisted(()=>vi.fn());
vi.mock('./boardApi',()=>({updateBoard:update}));
import BoardStudio from './BoardStudio.jsx';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('preserves a live same-Board save across an ordinary metadata refresh',async()=>{
 let finish;update.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const onBoardSaved=vi.fn();
 const {rerender}=render(<BoardStudio boards={[{id:'A',name:'Board A'}]} onBoardSaved={onBoardSaved}/>);
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 rerender(<BoardStudio boards={[{id:'A',name:'Refreshed Board A'}]} onBoardSaved={onBoardSaved}/>);
 await act(async()=>finish({id:'A',name:'Saved Board A'}));expect(onBoardSaved).toHaveBeenCalledWith({id:'A',name:'Saved Board A'});
});
it.each([false,true])('a disposed BoardStudio cannot notify, close or save its parent (reject=%s)',async reject=>{
 let resolve,fail;update.mockReturnValue(new Promise((a,b)=>{resolve=a;fail=b;}));
 const onBoardSaved=vi.fn(),onToast=vi.fn(),onClose=vi.fn();
 const {unmount}=render(<BoardStudio boards={[{id:'A',name:'A private Board'}]} onBoardSaved={onBoardSaved} onToast={onToast} onClose={onClose}/>);
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));unmount();
 await act(async()=>{reject?fail(new Error('A private failure')):resolve({id:'A',name:'A private result'});});
 expect(onBoardSaved).not.toHaveBeenCalled();expect(onToast).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
});
