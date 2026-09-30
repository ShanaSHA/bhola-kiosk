import {useEffect,useState} from 'react';
import Portal from '../Portal';
import {apiFetch} from '@/lib/api';
export default function Admin(){
 const [ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/auth/session',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(s=>{if(s.isStaff)setReady(true);else window.location.replace('/login')}).catch(()=>setError('Unable to check your session. Reload to try again.'))},[]);
 if(!ready)return <main className="load-state"><img className="login-logo" src="/media/dr-ashish-bhola-logo.jpg" alt="Dr. Ashish Bhola Dermatology Center"/><h2>Clinic administration</h2><p>{error||'Checking your session…'}</p></main>;
 return <Portal admin/>;
}
