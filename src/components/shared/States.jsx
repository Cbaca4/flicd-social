import React from 'react';
export function EmptyState({title='Nothing here yet',text,action}){return <div className="card" style={{textAlign:'center',padding:'36px 20px'}}><h3>{title}</h3>{text&&<p className="subtitle" style={{marginTop:7}}>{text}</p>}{action&&<div style={{marginTop:16}}>{action}</div>}</div>}
export function LoadingState({text='Loading…'}){return <div className="card" style={{textAlign:'center',padding:28}}><span className="status-dot"/> <span className="subtitle" style={{marginLeft:8}}>{text}</span></div>}
export function ErrorState({text='Something went wrong.'}){return <div className="card" style={{borderColor:'rgba(255,104,104,.35)'}}><strong style={{color:'var(--danger)'}}>Unable to load</strong><p className="subtitle" style={{marginTop:5}}>{text}</p></div>}
