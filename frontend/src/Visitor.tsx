import {useEffect,useRef,useState,type ReactNode} from 'react';
import {apiFetch} from './lib/api';
import {initialContent,type Content,type Item} from './lib/content';
import './kiosk.css';

type Screen='welcome'|'language'|'home'|'categories'|'services'|'detail'|'doctors'|'doctor'|'about'|'packages'|'package'|'contact';
type Position={screen:Screen;page:number;itemId:string;categoryId:string};
const start:Position={screen:'welcome',page:0,itemId:'',categoryId:''};
const pageSize=3;
function mediaUrl(value?:string){if(!value)return '';if(value.startsWith('/')&&!value.startsWith('//'))return value;try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?value:''}catch{return ''}}
function splitText(value:string,size=420){const result:string[]=[];let rest=value.trim();while(rest.length>size){let at=rest.lastIndexOf(' ',size);if(at<1)at=size;result.push(rest.slice(0,at));rest=rest.slice(at).trim()}if(rest)result.push(rest);return result}
function Photo({
  src,
  alt='',
  className=''
}:{
  src?:string;
  alt?:string;
  className?:string
}) {
  return (
    <img
      src={mediaUrl(src)}
      alt={alt}
      className={className}
    />
  );
}
export default function Visitor(){
 const [data,setData]=useState<Content>(initialContent),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
 const [position,setPosition]=useState<Position>(start),[history,setHistory]=useState<Position[]>([]),[lang,setLang]=useState<'en'|'ar'>('en');
 const [banner,setBanner]=useState(0),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
 const mainRef=useRef<HTMLElement>(null);
 const {screen,page,itemId,categoryId}=position;
 const t=(en:string,ar:string)=>lang==='ar'?ar:en;
 const field=(x:Item|Record<string,string>|undefined,k:string)=>{if(!x)return '';const r=x as Record<string,string>;return (lang==='ar'?r[k+'_ar']||r[k]:r[k])||''};
 async function load(){setError('');try{const r=await apiFetch('/api/content');if(!r.ok)throw new Error();const result=await r.json();if(!result.data||!Array.isArray(result.data.services))throw new Error();setData(result.data);setLoaded(true)}catch{setError(t('Clinic content could not be loaded. Please try again.','تعذر تحميل معلومات المركز. يرجى المحاولة مرة أخرى.'))}}
 useEffect(()=>{void load()},[]);
 useEffect(()=>{document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';return()=>{document.documentElement.dir='ltr'}},[lang]);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(q.matches);update();q.addEventListener('change',update);return()=>q.removeEventListener('change',update)},[]);
 const banners=data.banners.filter(b=>mediaUrl(b.image));
 const slides=[{id:'clinic',image:'/media/image27.webp'},...(banners.length?banners:[{id:'care',image:'/media/image28.webp'}])];
 useEffect(()=>{if(paused||reduced||screen!=='home'||slides.length<2)return;const timer=setInterval(()=>{if(!document.hidden)setBanner(n=>(n+1)%slides.length)},8000);return()=>clearInterval(timer)},[paused,reduced,screen,slides.length]);
 useEffect(()=>{mainRef.current?.scrollTo(0,0)},[position,lang]);
 function go(next:Screen,extras:Partial<Position>={}){setHistory(h=>[...h,position]);setPosition({...position,screen:next,page:0,...extras})}
 function back(){if(page>0){setPosition(p=>({...p,page:p.page-1}));return}const previous=history.at(-1);if(previous){setPosition(previous);setHistory(h=>h.slice(0,-1))}}
 const cats=[...data.categories].sort((a,b)=>Number(a.order||0)-Number(b.order||0));
 const cat=data.categories.find(c=>c.id===categoryId);
 let totalPages=1,status='';
 const arrow=<span className="circle-arrow" aria-hidden="true">{t('↗','↖')}</span>;
 function tile(name:string,sub:string,src:string|undefined,onClick:()=>void,cls=''){return <button className={`tile ${cls}`} onClick={onClick}><Photo src={src}/><span className="tile-label"><span>{sub&&<small>{sub}</small>}<strong>{name}</strong></span>{arrow}</span></button>}
 function heading(ey:string,title:string,sub=''){return <div className="section-head"><div><div className="eyebrow">{ey}</div><h1>{title}</h1></div>{sub&&<p>{sub}</p>}</div>}
 function action(label:string,next:Screen){return <button className="action" onClick={()=>go(next)}>{label}<span aria-hidden="true">{t('→','←')}</span></button>}
 function detail(src:string|undefined,body:ReactNode){return <div className="detail"><figure className="detail-photo"><Photo src={src}/></figure><section className="detail-copy">{body}</section></div>}
 function list(items:Item[],next:Screen){totalPages=Math.max(1,Math.ceil(items.length/pageSize));return items.length?<div className="collection">{items.slice(page*pageSize,page*pageSize+pageSize).map(i=><div className="tile-holder" key={i.id}>{tile(field(i,'name'),t('VIEW DETAILS','عرض التفاصيل'),i.image,()=>go(next,{itemId:i.id}))}</div>)}</div>:<div className="empty-state"><h2>{t('Speak with our reception team','تحدث مع فريق الاستقبال')}</h2><p>{t('Please contact reception for information and current availability.','يرجى التواصل مع الاستقبال للحصول على المعلومات والتفاصيل الحالية.')}</p>{action(t('Contact our clinic','تواصل مع المركز'),'contact')}</div>}
 let body:ReactNode;
 if(screen==='welcome'||screen==='language'){
  const language=screen==='language';

  const welcomeVideo=
    mediaUrl(data.welcome.video_url)||'/media/clinic-intro.mp4';

  const languageVideo=
    mediaUrl(data.welcome.language_video_url)||'/media/language-intro.mp4';

  const videoType=(url:string)=>
    url.toLowerCase().endsWith('.webm')
      ? 'video/webm'
      : 'video/mp4';

  body=(
    <div
      className={`welcome-screen ${language?'language-phase':''}`}
      onClick={()=>!language&&go('language')}
    >

      {!language ? (
        <>
          <video
            key={welcomeVideo}
            className="welcome-video"
            autoPlay
            muted
            playsInline
            poster="/media/dr-ashish-bhola-logo.jpg"
            onEnded={()=>go('language')}
          >
            <source
              src={welcomeVideo}
              type={videoType(welcomeVideo)}
            />
          </video>

          <div className="welcome-overlay"/>

          <div className="welcome-content welcome-video-prompt">

           <img
  src="/media/dr_ashish_bhola_logo_website_transparent.png"
  className="welcome-logo"
  alt="Dr. Ashish Bhola Dermatology Center"
/>
            <span className="welcome-kicker">
              DR. ASHISH BHOLA · DOHA
            </span>

            <h1>
              Welcome.
              <br/>
              <span>Discover Your Care.</span>
            </h1>

            <p>Tap anywhere to continue</p>

          </div>
        </>
      ) : (
        <>
          <video
            key={languageVideo}
            className="welcome-video language-video"
            autoPlay
            muted
            loop
            playsInline
            poster="/media/dr-ashish-bhola-logo.jpg"
          >
            <source
              src={languageVideo}
              type={videoType(languageVideo)}
            />
          </video>

          <div className="welcome-overlay language-overlay"/>

          <div className="welcome-content language-selection">

           <img
  src="/media/dr_ashish_bhola_logo_website_transparent.png"
  className="welcome-logo"
  alt="Dr. Ashish Bhola Dermatology Center"
/>

            <span className="welcome-kicker">
              DR. ASHISH BHOLA · DOHA
            </span>

            <h1>Choose Your Language</h1>

            <p>اختر لغتك للمتابعة</p>

            <div className="language-actions">

              <button
                onClick={e=>{
                  e.stopPropagation();
                  setLang('en');
                  go('home');
                }}
              >
                <span>English</span>
                <small>Continue in English</small>
              </button>

              <button
                onClick={e=>{
                  e.stopPropagation();
                  setLang('ar');
                  go('home');
                }}
              >
                <span>العربية</span>
                <small>المتابعة بالعربية</small>
              </button>

            </div>

          </div>
        </>
      )}

    </div>
  );

  status=language
    ? 'English · العربية'
    : 'Welcome · أهلاً بكم';
}else if(error||!loaded){body=<div className="empty-state"><h1>{t('Welcome','مرحباً')}</h1><p role={error?'alert':undefined}>{error||t('Loading clinic information…','جارٍ تحميل معلومات المركز…')}</p>{error&&<button className="action" onClick={()=>void load()}>{t('Try again','حاول مرة أخرى')}</button>}</div>}
 else if(screen==='home'){
  const current=slides[banner%slides.length];
  body=<><div className="banner"><div className="banner-copy"><div className="eyebrow">{t('WELCOME TO OUR CLINIC','مرحباً بكم في مركزنا')}</div><h1>{t('Your skin.','بشرتك.')}<br/>{t('Our expertise.','خبرتنا.')}</h1><p>{t('Touch a section to explore.','المس قسماً لاستكشافه.')}</p></div><div className="banner-photo"><Photo src={current.image} className="banner-image"/></div>{slides.length>1&&<div className="banner-controls"><button aria-label={t('Previous banner','الصورة السابقة')} onClick={()=>setBanner(n=>(n-1+slides.length)%slides.length)}>‹</button><button aria-label={paused?t('Play banner','تشغيل العرض'):t('Pause banner','إيقاف العرض')} onClick={()=>setPaused(v=>!v)}>{paused?'▶':'Ⅱ'}</button><button aria-label={t('Next banner','الصورة التالية')} onClick={()=>setBanner(n=>(n+1)%slides.length)}>›</button></div>}</div><nav className="tiles" aria-label={t('Clinic sections','أقسام المركز')}>{tile(t('Explore treatments','استكشف العلاجات'),t('CARE FOR YOUR SKIN','العناية ببشرتك'),data.services[0]?.image||'/media/image42.png',()=>go('categories'))}{tile(t('Medical team','الفريق الطبي'),t('MEET YOUR SPECIALIST','تعرّف على طبيبك'),data.doctors[0]?.image||'/media/image44.png',()=>go('doctors'),'doctor')}{tile(t('Our clinic','مركزنا'),t('GET TO KNOW US','تعرّف علينا'),'/media/image29.webp',()=>go('about'),'clinic')}{tile(t('Packages','الباقات'),t('TREATMENT OPTIONS','خيارات العلاج'),data.packages[0]?.image||'/media/image27.webp',()=>go('packages'))}{tile(t('Find us','موقعنا'),t('CONTACT & LOCATION','التواصل والموقع'),'/media/image3.jpg',()=>go('contact'),'contact')}</nav></>;
 }else if(screen==='categories'){
  totalPages=Math.max(1,Math.ceil(cats.length/pageSize));body=<>{heading(t('EXPLORE YOUR CARE','استكشف رعايتك'),t('Our treatments','علاجاتنا'),t('Select an image to discover more.','اختر صورة لمعرفة المزيد.'))}<div className="collection">{cats.slice(page*pageSize,page*pageSize+pageSize).map(c=><div className="tile-holder" key={c.id}>{tile(field(c,'name'),field(c,'description'),c.image,()=>go('services',{categoryId:c.id}))}</div>)}</div></>;
 }else if(screen==='services'){
  body=<>{heading(t('OUR TREATMENTS','علاجاتنا'),field(cat,'name'))}{list(data.services.filter(s=>s.category===categoryId),'detail')}</>;
 }else if(screen==='doctors'||screen==='packages'){
  body=<>{heading(t('OUR CLINIC','مركزنا'),screen==='doctors'?t('Medical team','الفريق الطبي'):t('Treatment packages','باقات العلاج'))}{list(screen==='doctors'?data.doctors:data.packages,screen==='doctors'?'doctor':'package')}</>;
 }else if(screen==='detail'||screen==='doctor'||screen==='package'){
  const item=(screen==='detail'?data.services:screen==='doctor'?data.doctors:data.packages).find(i=>i.id===itemId);
  if(!item){body=<div className="empty-state"><h1>{t('Item unavailable','هذا العنصر غير متاح')}</h1>{action(t('Return home','العودة للرئيسية'),'home')}</div>}
  else{
   const parts:{title:string;text:string;list?:boolean}[]=[];
   const add=(title:string,value:string,isList=false)=>{splitText(value).forEach(v=>parts.push({title,text:v,list:isList}))};
   add(t('Overview','نظرة عامة'),field(item,'description'));
   if(screen==='detail'){add(t('Benefits','الفوائد'),field(item,'benefits'),true);add(t('Related care','علاجات ذات صلة'),field(item,'related'))}
   if(screen==='doctor'){add(t('Experience','الخبرة'),field(item,'experience')?`${field(item,'experience')} ${t('years of experience','سنوات من الخبرة')}`:'');add(t('Expertise','الخبرات'),field(item,'expertise'),true)}
   if(screen==='package'){add(t('Price','السعر'),field(item,'price'));add(t('Included','تشمل الباقة'),field(item,'included'),true);add(t('Highlights','مميزات الباقة'),field(item,'highlights'),true)}
   if(!parts.length)parts.push({title:t('Information','معلومات'),text:t('Please contact reception for details.','يرجى التواصل مع الاستقبال للحصول على التفاصيل.')});
   totalPages=parts.length;const current=parts[Math.min(page,parts.length-1)];
   body=detail(item.image,<><div className="eyebrow">{screen==='detail'?field(cat,'name'):screen==='doctor'?t('YOUR MEDICAL TEAM','فريقك الطبي'):t('TREATMENT PACKAGE','باقة العلاج')}</div><h1>{field(item,'name')}</h1>{screen==='doctor'&&<p>{field(item,'qualification')}<br/>{field(item,'specialization')}</p>}<nav className="detail-tabs" aria-label={t('Information sections','أقسام المعلومات')}>{parts.map((part,index)=>parts.findIndex(p=>p.title===part.title)===index?<button key={part.title} aria-current={part.title===current.title?'page':undefined} onClick={()=>setPosition(p=>({...p,page:index}))}>{part.title}</button>:null)}</nav><h2>{current.title}</h2>{current.list?<ul className="benefits">{current.text.split('\n').filter(Boolean).map((line,i)=><li key={i}>{line}</li>)}</ul>:<p className="content-text">{current.text}</p>}{screen==='detail'&&<p className="fine">{t('Please speak with our clinical team for advice on suitability.','يرجى التحدث مع فريقنا الطبي لمعرفة مدى ملاءمة العلاج.')}</p>}</>);
  }
 }else if(screen==='about'){
  const labels:Record<string,[string,string]>={overview:['Our clinic','مركزنا'],profile:['Our approach','نهجنا'],vision:['Vision','الرؤية'],mission:['Mission','الرسالة'],aim:['Our aim','هدفنا'],whyChoose:['Why choose us','لماذا تختارنا'],technology:['Technology','التقنيات'],patientCare:['Patient care','رعاية المرضى']};
  const sections=Object.entries(labels).flatMap(([k,label])=>splitText(field(data.about,k)).map(text=>({title:t(...label),text})));
  totalPages=Math.max(1,sections.length);const part=sections[Math.min(page,sections.length-1)];
  body=detail('/media/image29.webp',<><div className="eyebrow">{t('DR. ASHISH BHOLA · DOHA','د. أشيش بهولا · الدوحة')}</div><h1>{part?.title||t('Our clinic','مركزنا')}</h1><p className="content-text">{part?.text||t('Please speak to our team to learn more.','تحدث مع فريقنا لمعرفة المزيد.')}</p></>);
 }else{
  const groups=[{title:t('Visit our clinic','زوروا مركزنا'),values:[field(data.contact,'address'),field(data.contact,'hours')]},{title:t('Speak to our team','تحدث مع فريقنا'),values:[field(data.contact,'telephone'),field(data.contact,'telephone2'),field(data.contact,'mobile'),field(data.contact,'email')]},{title:t('Online','عبر الإنترنت'),values:['instagram','facebook','tiktok','map'].map(k=>data.contact[k]).filter(Boolean)}].filter(g=>g.values.some(Boolean));
  const pages=groups.flatMap(g=>splitText(g.values.filter(Boolean).join('\n\n')).map(text=>({title:g.title,text})));
  totalPages=Math.max(1,pages.length);const current=pages[Math.min(page,pages.length-1)];
  body=detail('/media/image3.jpg',<><div className="eyebrow">{t('CONTACT & LOCATION','التواصل والموقع')}</div><h1>{current?.title||t('Contact','التواصل')}</h1><p className="content-text contact-text">{current?.text}</p></>);
 }
 if(!['welcome','language','home'].includes(screen)&&loaded&&!error)status=t(`${page+1} / ${totalPages} · Clinic information`,`${page+1} / ${totalPages} · معلومات المركز`);
 return (
  <div className="visitor-app">
    <div className="device">

      {!['welcome', 'language'].includes(screen) && (
        <header className="header">
          <div className="brand-ribbon">
            <Photo
              src="/media/dr-ashish-bhola-logo.jpg"
              alt="Dr. Ashish Bhola Dermatology Center"
            />
          </div>

          <button
            className="language"
            onClick={() => go('language')}
          >
            English / العربية
          </button>
        </header>
      )}

      <main
        ref={mainRef}
        className={`stage stage-${screen}`}
        key={screen + page}
        aria-live="polite"
      >
        {body}
      </main>
  {!['welcome', 'language'].includes(screen) && (
  <footer className="footer">

    <div className="footer-actions">

      {screen !== 'welcome' && (
        <button
  onClick={back}
  disabled={!history.length && page === 0}
>
  {t('← Back', 'عودة →')}
</button>
      )}

      <button onClick={() => go('home')}>
        {t('Home', 'الرئيسية')}
      </button>

      <button onClick={() => go('categories')}>
        {t('Treatments', 'العلاجات')}
      </button>

      <button onClick={() => go('doctors')}>
        {t('Medical Team', 'الفريق الطبي')}
      </button>

      <button onClick={() => go('about')}>
        {t('Our Clinic', 'مركزنا')}
      </button>

      <button onClick={() => go('packages')}>
        {t('Packages', 'الباقات')}
      </button>

      <button onClick={() => go('contact')}>
        {t('Find Us', 'موقعنا')}
      </button>

    </div>

    

   
    </footer>
)}

    </div>
  </div>
);
}
