import {createRoot} from 'react-dom/client';
import Visitor from './Visitor';
import Admin from './pages/Admin';
import Login from './pages/Login';
import './styles.css';
const path=window.location.pathname.replace(/\/+$/,'')||'/';
const page=path==='/admin'?<Admin/>:path==='/login'?<Login/>:path==='/'?<Visitor/>:<main className="load-state"><h1>Page not found</h1><a href="/">Return to kiosk</a></main>;
createRoot(document.getElementById('root')!).render(page);
