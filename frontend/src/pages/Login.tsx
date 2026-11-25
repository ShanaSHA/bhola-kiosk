
import {useState} from 'react';
import {apiFetch} from '@/lib/api';
import {Globe2,Eye,EyeOff} from 'lucide-react';

export default function Login(){

  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);

  const [lang,setLang]=useState<'en'|'ar'>(
    (localStorage.getItem('bhola-language') as 'en'|'ar')||'en'
  );

  const ar=lang==='ar';

  function changeLanguage(next:'en'|'ar'){
    setLang(next);
    localStorage.setItem('bhola-language',next);
    document.documentElement.lang=next;
    document.documentElement.dir=next==='ar'?'rtl':'ltr';
  }

  return (
    <main className="load-state login-page">

      <div className="login-card">

        <div className="login-tools">
          <Globe2 size={16}/>

          <button
            type="button"
            className={!ar?'active':''}
            onClick={()=>changeLanguage('en')}
          >
            EN
          </button>

          <span>/</span>

          <button
            type="button"
            className={ar?'active':''}
            onClick={()=>changeLanguage('ar')}
          >
            ع
          </button>
        </div>

        <img
          className="login-logo"
          src="/media/dr-ashish-bhola-logo.jpg"
          alt="Dr. Ashish Bhola Dermatology Center"
        />

        <span className="eyebrow">
          {ar
            ?'إدارة مركز د. أشيش بهولا'
            :'DR. ASHISH BHOLA DERMATOLOGY CENTER'}
        </span>

        <h1>
          {ar?'تسجيل دخول الموظفين':'Staff sign in'}
        </h1>

        <form
          style={{width:'min(420px,90vw)'}}
          onSubmit={async e=>{
            e.preventDefault();
            setError('');
            setBusy(true);

            const form=new FormData(e.currentTarget);

            try{
              const r=await apiFetch('/api/auth/login',{
                method:'POST',
                headers:{
                  'Content-Type':'application/json'
                },
                body:JSON.stringify({
                  username:form.get('username'),
                  password:form.get('password')
                })
              });

              const j=await r.json();

              if(!r.ok){
                throw Error(j.error||'Unable to sign in');
              }

              window.location.assign('/admin');

            }catch(e){
              setError(
                e instanceof Error
                  ?e.message
                  :'Unable to sign in'
              );

              setBusy(false);
            }
          }}
        >

          <div
            className="edit-grid"
            style={{gridTemplateColumns:'1fr'}}
          >

            <label>
              {ar?'اسم المستخدم':'Username'}

              <input
                name="username"
                autoComplete="username"
                required
                maxLength={150}
              />
            </label>

            <label className="password-field">
              {ar?'كلمة المرور':'Password'}

              <div className="password-input-wrap">

                <input
                  name="password"
                  type={showPassword?'text':'password'}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-eye"
                  onClick={()=>setShowPassword(v=>!v)}
                  aria-label={
                    showPassword
                      ?(ar?'إخفاء كلمة المرور':'Hide password')
                      :(ar?'إظهار كلمة المرور':'Show password')
                  }
                  title={
                    showPassword
                      ?(ar?'إخفاء كلمة المرور':'Hide password')
                      :(ar?'إظهار كلمة المرور':'Show password')
                  }
                >
                  {showPassword
                    ?<EyeOff size={20}/>
                    :<Eye size={20}/>
                  }
                </button>

              </div>
            </label>

          </div>

          {error&&(
            <p
              role="alert"
              style={{
                color:'#a73232',
                marginBottom:18
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="gold-button"
            style={{width:'100%'}}
          >
            {busy
              ?(ar?'جارٍ الدخول…':'Signing in…')
              :(ar?'تسجيل الدخول':'Sign in')}
          </button>

        </form>

        <a href="/">
          {ar?'العودة إلى الموقع':'Return to kiosk'}
        </a>

      </div>

    </main>
  );
}
