/** @vitest-environment jsdom */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { it,vi,expect,afterEach } from 'vitest';
import { screen,fireEvent,act,cleanup } from '@testing-library/react';
import { renderAccount } from '../../../tests/security/renderAccount.jsx';
import { testAuthScope } from '../../../tests/security/testAuthScope.js';
const render = (ui, options) => renderAccount(ui, 'A', options);
const m=vi.hoisted(()=>({getUser:vi.fn(),update:vi.fn()}));
vi.mock('../../lib/supabase',()=>({supabase:{auth:{getUser:m.getUser},from:()=>({update:m.update})},createAccountClient:()=>({from:()=>({update:m.update})})}));
import EditProfile from './EditProfile.jsx';
afterEach(cleanup);
it('shows a current rejected save and permits retry instead of leaving the form busy',async()=>{
 m.getUser.mockResolvedValue({data:{user:{id:'A'}}});
 m.update.mockReturnValue({eq:()=>({select:()=>({single:async()=>{throw new Error('Current write failed');}})})});
 const {container}=render(<EditProfile profile={{id:'A',handle:'A'}}/>);fireEvent.submit(container.querySelector('form'));
 expect(await screen.findByText('Current write failed')).toBeInTheDocument();expect(container.querySelector('button[type=submit]')).not.toBeDisabled();
});
it('consumes a stale rejected profile write after disposal without an unhandled rejection',async()=>{
 m.getUser.mockResolvedValue({data:{user:{id:'A'}}});let fail;
 m.update.mockReturnValue({eq:()=>({select:()=>({single:()=>new Promise((_,reject)=>{fail=reject;})})})});
 const saved=vi.fn();const {container,unmount}=render(<EditProfile profile={{id:'A',handle:'A'}} onSaved={saved}/>);
 fireEvent.submit(container.querySelector('form'));await act(async()=>{});expect(fail).toBeTypeOf('function');unmount();
 await act(async()=>{fail(new Error('A private rejected write'));});expect(saved).not.toHaveBeenCalled();
});
it('a pending identity lookup cannot write the old profile draft into the replacement account',async()=>{
 let finish;m.getUser.mockReturnValue(new Promise(resolve=>{finish=resolve;}));m.update.mockReturnValue({eq:()=>({select:()=>({single:async()=>({data:{id:'B'},error:null})})})});
 let active=true;const saved=vi.fn();const {container,unmount}=render(<EditProfile profile={{id:'A',handle:'A-private',bio:'private draft'}} authScope={testAuthScope('A',()=>active)} onSaved={saved}/>);
 fireEvent.submit(container.querySelector('form'));active=false;unmount();await act(async()=>finish({data:{user:{id:'B'}}}));
 expect(m.update).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();
});
