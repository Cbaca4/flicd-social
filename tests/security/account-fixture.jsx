// Synthetic API/surface seams for the REAL FlicdApp + BoardStudio browser test.
// Loaded only by the isolated account browser fixture, never the app entrypoint.
import React from 'react';
import { accountFixture as f } from './accountFixtureApi.js';
const payload={mood:'',expiry:'24h',channel:'main',frameCount:1,items:[{note:'synthetic private draft'}]};
export const DumpBuilder=({onPost})=><button onClick={()=>void onPost(payload).catch(()=>{})}>Post draft</button>;
export const RollBuilder=DumpBuilder;
export const Viewer=({post})=><div data-testid="viewer">{post.id}</div>;
export function Surface(p){
 if(p.kind==='AppShell')return <><header data-account={p.userId} data-screen={p.screen}><span>LOCAL SYNTHETIC ACCOUNT QA</span><button onClick={()=>f.switch('A')}>Switch A</button><button onClick={()=>f.switch('B')}>Switch B</button>{['home','profile','notifications','create-dump','create-roll'].map(key=><button key={key} onClick={()=>p.onNavigate(key)}>{key}</button>)}</header>{p.children}</>;
 if(p.kind==='Home')return <div data-testid="feed">{p.dumps.map(x=>x.id).join(',')}</div>;
 if(p.kind==='Profile')return <div data-testid="profile"><p>Account {p.profile.id}</p><button onClick={p.onCustomizeBoards}>Board Studio</button></div>;
 if(p.kind==='Notifications')return <button onClick={()=>p.onOpenDump('private')}>Open private notification</button>;
 return <div>{p.kind}</div>;
}
