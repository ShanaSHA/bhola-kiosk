
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {apiFetch} from './lib/api';
import {initialContent,type Content,type Item} from './lib/content';
import './kiosk.css';

type Screen='welcome'|'language'|'home'|'categories'|'services'|'detail'|'doctors'|'doctor'|'about'|'packages'|'package'|'contact';

type Position={
  screen:Screen;
  page:number;
  itemId:string;
  categoryId:string;
};

type ContactPage={
  title:string;
  type:'visit'|'team'|'social';
};

const start:Position={
  screen:'welcome',
  page:0,
  itemId:'',
  categoryId:''
};

const pageSize=3;

function mediaUrl(value?:string){
  if(!value)return '';

  if(value.startsWith('/')&&!value.startsWith('//'))return value;

  try{
    const u=new URL(value);
    return ['https:','http:'].includes(u.protocol)?value:'';
  }catch{
    return '';
  }
}

function splitText(value:string,size=420){
  const result:string[]=[];
  let rest=value.trim();

  while(rest.length>size){
    let at=rest.lastIndexOf(' ',size);
    if(at<1)at=size;

    result.push(rest.slice(0,at));
    rest=rest.slice(at).trim();
  }

  if(rest)result.push(rest);

  return result;
}

function Photo({
  src,
  alt='',
  className=''
}:{
  src?:string;
  alt?:string;
  className?:string;
}) {
  return (
    <img
      src={mediaUrl(src)}
      alt={alt}
      className={className}
    />
  );
}

// Location and opening-hours icons
function ContactSvg({
  name
}:{
  name:'map-pin'|'clock';
}){
  if(name==='map-pin'){
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="10"
          r="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 7v5l3 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Visitor(){

  const [data,setData]=useState<Content>(initialContent);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');

  const [position,setPosition]=useState<Position>(start);
  const [history,setHistory]=useState<Position[]>([]);
  const [lang,setLang]=useState<'en'|'ar'>('en');

  const [banner,setBanner]=useState(0);
  const [reduced,setReduced]=useState(false);

  const mainRef=useRef<HTMLElement>(null);
  const inactivityTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const {screen,page,itemId,categoryId}=position;

  // Translation
  const t=(en:string,ar:string)=>lang==='ar'?ar:en;

  const field=(
    x:Item|Record<string,string>|undefined,
    k:string
  )=>{
    if(!x)return '';

    const r=x as Record<string,string>;

    return (lang==='ar'?r[k+'_ar']||r[k]:r[k])||'';
  };

  // Auto return to Welcome after inactivity
  useEffect(()=>{
    if(screen==='welcome')return;

    const returnToWelcome=()=>{
      setPosition(start);
      setHistory([]);
      setBanner(0);
    };

    const resetTimer=()=>{
      if(inactivityTimer.current){
        clearTimeout(inactivityTimer.current);
      }

      inactivityTimer.current=setTimeout(()=>{
        returnToWelcome();
      },60000);
    };

    const events=[
      'pointerdown',
      'touchstart',
      'click',
      'keydown',
      'wheel'
    ];

    events.forEach(event=>{
      window.addEventListener(event,resetTimer,{passive:true});
    });

    resetTimer();

    return()=>{
      if(inactivityTimer.current){
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current=null;
      }

      events.forEach(event=>{
        window.removeEventListener(event,resetTimer);
      });
    };
  },[screen]);

  // Admin uploaded images
  const welcomeContent=data.welcome as Record<string,string>;

  const findUsImage=
    welcomeContent.find_us_image_url||'/media/image3.jpg';

  const aboutImage=
    welcomeContent.about_image_url||'/media/image29.webp';

  // Load clinic content
  async function load(){
    setError('');

    try{
      const r=await apiFetch('/api/content');

      if(!r.ok)throw new Error();

      const result=await r.json();

      if(!result.data||!Array.isArray(result.data.services)){
        throw new Error();
      }

      setData(result.data);
      setLoaded(true);

    }catch{
      setError(
        t(
          'Clinic content could not be loaded. Please try again.',
          'تعذر تحميل معلومات المركز. يرجى المحاولة مرة أخرى.'
        )
      );
    }
  }

  useEffect(()=>{
    void load();
  },[]);

  // Language direction
  useEffect(()=>{
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';

    return()=>{
      document.documentElement.dir='ltr';
    };
  },[lang]);

  // Reduced motion preference
  useEffect(()=>{
    const q=matchMedia('(prefers-reduced-motion: reduce)');

    const update=()=>setReduced(q.matches);

    update();

    q.addEventListener('change',update);

    return()=>q.removeEventListener('change',update);
  },[]);

  // Banners
  const banners=data.banners.filter(b=>mediaUrl(b.image));
  const slides=banners;

  useEffect(()=>{
    if(reduced||screen!=='home'||slides.length<2)return;

    const timer=setInterval(()=>{
      if(!document.hidden){
        setBanner(n=>(n+1)%slides.length);
      }
    },8000);

    return()=>clearInterval(timer);
  },[reduced,screen,slides.length]);

  // Scroll to top when changing page
  useEffect(()=>{
    mainRef.current?.scrollTo(0,0);
  },[position,lang]);

  // Navigation
  function go(next:Screen,extras:Partial<Position>={}){
    setHistory(h=>[...h,position]);

    setPosition({
      ...position,
      screen:next,
      page:0,
      ...extras
    });
  }

  function back(){
    if(page>0){
      setPosition(p=>({...p,page:p.page-1}));
      return;
    }

    const previous=history.at(-1);

    if(previous){
      setPosition(previous);
      setHistory(h=>h.slice(0,-1));
    }
  }

  // Categories
  const cats=[
    ...data.categories
  ].sort((a,b)=>Number(a.order||0)-Number(b.order||0));

  const cat=data.categories.find(c=>c.id===categoryId);

  let totalPages=1;
  let status='';

  const arrow=(
    <span className="circle-arrow" aria-hidden="true">
      {t('↗','↖')}
    </span>
  );

  // Reusable tile
  function tile(
    name:string,
    sub:string,
    src:string|undefined,
    onClick:()=>void,
    cls=''
  ){
    return (
      <button className={`tile ${cls}`} onClick={onClick}>
        <Photo src={src}/>

        <span className="tile-label">
          <span>
           
            <strong>{name}</strong>
             {sub&&<small>{sub}</small>}
          </span>

          {arrow}
        </span>
      </button>
    );
  }

  // Section heading
  function heading(ey:string,title:string,sub=''){
    return (
      <div className="section-head">
        <div>
          <div className="eyebrow">{ey}</div>
          <h1>{title}</h1>
        </div>

        {sub&&<p>{sub}</p>}
      </div>
    );
  }

  // Action button
  function action(label:string,next:Screen){
    return (
      <button className="action" onClick={()=>go(next)}>
        {label}
        <span aria-hidden="true">{t('→','←')}</span>
      </button>
    );
  }

  // Detail layout
  function detail(src:string|undefined,body:ReactNode){
    return (
      <div className="detail">
        <figure className="detail-photo">
          <Photo src={src}/>
        </figure>

        <section className="detail-copy">
          {body}
        </section>
      </div>
    );
  }

  // Contact link generation
  function contactLink(value:string,key:string){

    const v=value.trim();

    if(!v)return '';

    if(key==='email'){
      return `mailto:${v}`;
    }

    if(
      key==='telephone'||
      key==='telephone2'||
      key==='mobile'
    ){
      return `tel:${v.replace(/[^\d+]/g,'')}`;
    }

    if(key==='map'){
      if(/^https?:\/\//i.test(v))return v;

      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
    }

    if(/^https?:\/\//i.test(v)){
      return v;
    }

    if(
      key==='instagram'||
      key==='facebook'||
      key==='tiktok'
    ){
      return `https://${v.replace(/^\/\//,'').replace(/^www\./,'')}`;
    }

    return v;
  }

  // Social media icons
  function contactIcon(name:string,value:string){

    const labels:Record<string,[string,string]>={
      instagram:['Instagram','إنستغرام'],
      facebook:['Facebook','فيسبوك'],
      tiktok:['TikTok','تيك توك']
    };

    const href=contactLink(value,name);

    if(!href)return null;

    return (
      <a
        key={name}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`contact-icon-link icon-${name}`}
        aria-label={t(
          labels[name]?.[0]||name,
          labels[name]?.[1]||name
        )}
      >
        <span className="contact-symbol">

          {name==='instagram'&&(
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="12"
                cy="12"
                r="4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="17.5"
                cy="6.8"
                r="1.2"
                fill="currentColor"
              />
            </svg>
          )}

          {name==='facebook'&&(
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8z"
              />
            </svg>
          )}

          {name==='tiktok'&&(
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19.5 8.2a6.6 6.6 0 0 1-4-1.4v8.1a5.6 5.6 0 1 1-5.6-5.6c.4 0 .8 0 1.2.1v3.1a2.5 2.5 0 1 0 1.3 2.2V3h3.1c.2 2 1.7 3.7 4 4z"
              />
            </svg>
          )}

        </span>

        <small>
          {t(
            labels[name]?.[0]||name,
            labels[name]?.[1]||name
          )}
        </small>
      </a>
    );
  }

  // Reusable list
  function list(items:Item[],next:Screen){

    totalPages=1;

    return items.length?(
      <div className="collection">

        {items.map(i=>(
          <div className="tile-holder" key={i.id}>
            {tile(
              field(i,'name'),

              i.price
                ?`${t('QAR','ر.ق')} ${field(i,'price')}`
                :t('VIEW DETAILS','عرض التفاصيل'),

              i.image,

              ()=>go(next,{itemId:i.id})
            )}
          </div>
        ))}

      </div>
    ):(
      <div className="empty-state">

        <h2>
          {t(
            'Speak with our reception team',
            'تحدث مع فريق الاستقبال'
          )}
        </h2>

        <p>
          {t(
            'Please contact reception for information and current availability.',
            'يرجى التواصل مع الاستقبال للحصول على المعلومات والتفاصيل الحالية.'
          )}
        </p>

        {action(
          t('Contact our clinic','تواصل مع المركز'),
          'contact'
        )}

      </div>
    );
  }

  let body:ReactNode;

  // WELCOME AND LANGUAGE
  if(screen==='welcome'||screen==='language'){

    const language=screen==='language';

    const welcomeVideo=
      mediaUrl(data.welcome.video_url)||'/media/clinic-intro.mp4';

    const languageVideo=
      mediaUrl(data.welcome.language_video_url)||'/media/language-intro.mp4';

    const videoType=(url:string)=>
      url.toLowerCase().endsWith('.webm')
        ?'video/webm'
        :'video/mp4';

    body=(
      <div
        className={`welcome-screen ${language?'language-phase':''}`}
        onClick={()=>!language&&go('language')}
      >

        {!language?(
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
                src="/media/dr_ashish_bhola_logo_glossy.png"
                className="welcome-logo"
                alt="Dr. Ashish Bhola Dermatology Center"
              />

              <h1>
                Welcome
                <br/>
                <span>Discover Your Care</span>
              </h1>

              <p>Tap anywhere to continue</p>

            </div>

          </>
        ):(
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
                src="/media/dr_ashish_bhola_logo_glossy.png"
                className="welcome-logo"
                alt="Dr. Ashish Bhola Dermatology Center"
              />

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
      ?'English · العربية'
      :'Welcome · أهلاً بكم';

  // LOADING
  }else if(error||!loaded){

    body=(
      <div className="empty-state">

        <h1>{t('Welcome','مرحباً')}</h1>

        <p role={error?'alert':undefined}>
          {error||t(
            'Loading clinic information…',
            'جارٍ تحميل معلومات المركز…'
          )}
        </p>

        {error&&(
          <button
            className="action"
            onClick={()=>void load()}
          >
            {t('Try again','حاول مرة أخرى')}
          </button>
        )}

      </div>
    );

  // HOME
  }else if(screen==='home'){

    const current=slides[banner%slides.length];

    body=(
      <>

        <div className="banner">

          <div className="banner-copy">

            <div className="eyebrow">
              {t('WELCOME TO OUR CLINIC','مرحباً بكم في مركزنا')}
            </div>

           <h1>
  {field(data.welcome, 'title')
    .split('\n')
    .map((line, i) => (
      <span key={i} className={i === 1 ? 'gold-text' : ''}>
        {line}
        {i === 0 && <br />}
      </span>
    ))}
</h1>

<p>
  {field(data.welcome, 'description')}
</p>

          </div>

          <div className="banner-photo">
            <Photo
              src={current?.image}
              className="banner-image"
            />
          </div>

          {slides.length>1&&(
            <div className="banner-controls">

              <button
                aria-label={t('Previous banner','الصورة السابقة')}
                onClick={()=>setBanner(n=>(n-1+slides.length)%slides.length)}
              >
                ‹
              </button>

              <button
                aria-label={t('Next banner','الصورة التالية')}
                onClick={()=>setBanner(n=>(n+1)%slides.length)}
              >
                ›
              </button>

            </div>
          )}

        </div>

        <nav
          className="tiles"
          aria-label={t('Clinic sections','أقسام المركز')}
        >

          {tile(
            t('Explore treatments','استكشف العلاجات'),
            t('CARE FOR YOUR SKIN','العناية ببشرتك'),
            data.services[0]?.image||'/media/image42.png',
            ()=>go('categories')
          )}

          {tile(
            t('Medical team','الفريق الطبي'),
            t('MEET YOUR SPECIALIST','تعرّف على طبيبك'),
            data.doctors[0]?.image||'/media/image44.png',
            ()=>go('doctors'),
            'doctor'
          )}

          {tile(
            t('About Us','من نحن'),
            t('GET TO KNOW US','تعرّف علينا'),
            aboutImage,
            ()=>go('about'),
            'clinic'
          )}

          {tile(
            t('Offers','عروض'),
            t('TREATMENT OPTIONS','خيارات العلاج'),
            welcomeContent.offers_image_url||
              data.packages[0]?.image||
              '/media/image27.webp',
            ()=>go('packages')
          )}

          {tile(
            t('Find us','موقعنا'),
            t('CONTACT & LOCATION','التواصل والموقع'),
            findUsImage,
            ()=>go('contact'),
            'contact'
          )}

        </nav>

      </>
    );

  // CATEGORIES
  }else if(screen==='categories'){

    totalPages=1;

    body=(
      <>

        {heading(
          t('EXPLORE YOUR CARE','استكشف رعايتك'),
          t('Our treatments','علاجاتنا'),
          t(
            'Select an image to discover more.',
            'اختر صورة لمعرفة المزيد.'
          )
        )}

        <div className="collection">

          {cats.map(c=>(
            <div className="tile-holder" key={c.id}>
              {tile(
                field(c,'name'),
                field(c,'description'),
                c.image,
                ()=>go('services',{categoryId:c.id})
              )}
            </div>
          ))}

        </div>

      </>
    );

  // SERVICES
  }else if(screen==='services'){

    body=(
      <>

        {heading(
          t('OUR TREATMENTS','علاجاتنا'),
          field(cat,'name')
        )}

        {list(
          data.services.filter(s=>s.category===categoryId),
          'detail'
        )}

      </>
    );

  // DOCTORS AND OFFERS
  }else if(screen==='doctors'||screen==='packages'){

    body=(
      <>

        {heading(
          t('OUR CLINIC','مركزنا'),

          screen==='doctors'
            ?t('Medical team','الفريق الطبي')
            :t('Treatment Offers','عروض العلاج')
        )}

        {list(
          screen==='doctors'?data.doctors:data.packages,
          screen==='doctors'?'doctor':'package'
        )}

      </>
    );

  // DETAILS
  }else if(screen==='detail'||screen==='doctor'||screen==='package'){

    const item=(
      screen==='detail'
        ?data.services
        :screen==='doctor'
          ?data.doctors
          :data.packages
    ).find(i=>i.id===itemId);

    if(!item){

      body=(
        <div className="empty-state">
          <h1>{t('Item unavailable','هذا العنصر غير متاح')}</h1>
          {action(t('Return home','العودة للرئيسية'),'home')}
        </div>
      );

    }else{

      const parts:{
        title:string;
        text:string;
        list?:boolean;
      }[]=[];

      const add=(
        title:string,
        value:string,
        isList=false
      )=>{
        if(value&&value.trim()){
          parts.push({
            title,
            text:value.trim(),
            list:isList
          });
        }
      };

      add(
        t('Overview','نظرة عامة'),
        field(item,'description')
      );

      if(screen==='detail'){

        if(field(item,'price')){
          add(
            t('Price','السعر'),
            `${t('QAR','ر.ق')} ${field(item,'price')}`
          );
        }

        add(
          t('Benefits','الفوائد'),
          field(item,'benefits'),
          true
        );

        add(
          t('Related care','علاجات ذات صلة'),
          field(item,'related')
        );
      }

      if(screen==='doctor'){

        add(
          t('Experience','الخبرة'),
          field(item,'experience')
            ?`${field(item,'experience')} ${t('years of experience','سنوات من الخبرة')}`
            :''
        );

        add(
          t('Expertise','الخبرات'),
          field(item,'expertise'),
          true
        );
      }

      if(screen==='package'){

        add(
          t('Price','السعر'),
          field(item,'price')
        );

        add(
          t('Included','تشمل الباقة'),
          field(item,'included'),
          true
        );

        add(
          t('Highlights','مميزات الباقة'),
          field(item,'highlights'),
          true
        );
      }

      if(!parts.length){
        parts.push({
          title:t('Information','معلومات'),
          text:t(
            'Please contact reception for details.',
            'يرجى التواصل مع الاستقبال للحصول على التفاصيل.'
          )
        });
      }

      totalPages=parts.length;

      const current=parts[Math.min(page,parts.length-1)];

      body=detail(
        item.image,
        <>

          <div className="eyebrow">
            {screen==='detail'
              ?field(cat,'name')
              :screen==='doctor'
                ?t('YOUR MEDICAL TEAM','فريقك الطبي')
                :t('TREATMENT PACKAGE','باقة العلاج')}
          </div>

          <h1>{field(item,'name')}</h1>

          {screen==='doctor'&&(
            <p>
              {field(item,'qualification')}
              <br/>
              {field(item,'specialization')}
            </p>
          )}

          <nav
            className="detail-tabs"
            aria-label={t('Information sections','أقسام المعلومات')}
          >

            {parts.map((part,index)=>
              parts.findIndex(p=>p.title===part.title)===index?(
                <button
                  key={part.title}
                  aria-current={
                    part.title===current.title?'page':undefined
                  }
                  onClick={()=>setPosition(p=>({...p,page:index}))}
                >
                  {part.title}
                </button>
              ):null
            )}

          </nav>

          <h2>{current.title}</h2>

          {current.list?(
            <ul className="benefits">
              {current.text.split('\n').filter(Boolean).map((line,i)=>(
                <li key={i}>{line}</li>
              ))}
            </ul>
          ):(
            <p className="content-text">{current.text}</p>
          )}

          {screen==='detail'&&(
            <p className="fine">
              {t(
                'Please speak with our clinical team for advice on suitability.',
                'يرجى التحدث مع فريقنا الطبي لمعرفة مدى ملاءمة العلاج.'
              )}
            </p>
          )}

        </>
      );
    }

  // ABOUT US
  }else if(screen==='about'){

    const labels:Record<string,[string,string]>={
      overview:['About Us','من نحن'],
      profile:['Our approach','نهجنا'],
      vision:['Vision','الرؤية'],
      mission:['Mission','الرسالة'],
      aim:['Our aim','هدفنا'],
      whyChoose:['Why choose us','لماذا تختارنا'],
      technology:['Technology','التقنيات'],
      patientCare:['Patient care','رعاية المرضى']
    };

    const sections=Object.entries(labels).flatMap(([k,label])=>
      splitText(field(data.about,k)).map(text=>({
        title:t(...label),
        text
      }))
    );

    totalPages=Math.max(1,sections.length);

    const part=sections[Math.min(page,sections.length-1)];

    body=detail(
      aboutImage,
      <>

        <div className="eyebrow">
          {t('ABOUT OUR CLINIC','عن مركزنا')}
        </div>

        <h1>
          {part?.title||t('About Us','من نحن')}
        </h1>

        <p className="content-text">
          {part?.text||t(
            'Please speak to our team to learn more.',
            'تحدث مع فريقنا لمعرفة المزيد.'
          )}
        </p>

      </>
    );

  // FIND US AND CONTACT
  }else{

    const address=field(data.contact,'address');
    const hours=field(data.contact,'hours');

    const phoneNumbers=[
      field(data.contact,'telephone'),
      field(data.contact,'telephone2'),
      field(data.contact,'mobile')
    ].filter(Boolean);

    const email=field(data.contact,'email');

    const socialLinks=[
      {
        key:'instagram',
        value:data.contact.instagram
      },
      {
        key:'facebook',
        value:data.contact.facebook
      },
      {
        key:'tiktok',
        value:data.contact.tiktok
      }
    ].filter(item=>item.value);

    const pages:ContactPage[]=[
      {
        title:t('Visit our clinic','زوروا مركزنا'),
        type:'visit'
      },
      {
        title:t('Speak to our team','تحدث مع فريقنا'),
        type:'team'
      },
      {
        title:t('Connect with us','تواصل معنا'),
        type:'social'
      }
    ];

    totalPages=pages.length;

    const current=pages[Math.min(page,pages.length-1)];

    body=detail(
      findUsImage,
      <>

        <div className="eyebrow">
          {t('CONTACT & LOCATION','التواصل والموقع')}
        </div>

        <h1>{current.title}</h1>

        {current.type==='visit'&&(
          <div className="contact-page-content">

            {address&&(
              <div className="contact-detail-block">

                <span className="contact-info-icon">
                  <ContactSvg name="map-pin"/>
                </span>

                <div>
                  <h2>{t('Clinic address','عنوان المركز')}</h2>
                  <p className="content-text">{address}</p>
                </div>

              </div>
            )}

            {hours&&(
              <div className="contact-detail-block">

                <span className="contact-info-icon">
                  <ContactSvg name="clock"/>
                </span>

                <div>
                  <h2>{t('Opening hours','ساعات العمل')}</h2>
                  <p className="content-text">{hours}</p>
                </div>

              </div>
            )}

            {!address&&!hours&&(
              <p className="content-text">
                {t(
                  'Please contact our clinic for location and opening hours.',
                  'يرجى التواصل مع المركز لمعرفة الموقع وساعات العمل.'
                )}
              </p>
            )}

            {data.contact.map&&(
              <a
                className="contact-map-link"
                href={contactLink(data.contact.map,'map')}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('View location on Google Maps','عرض الموقع على خرائط Google')}
                <span>↗</span>
              </a>
            )}

          </div>
        )}

        {current.type==='team'&&(
          <div className="contact-page-content">

            <p className="content-text">
              {t(
                'Our team is here to help with appointments and enquiries.',
                'فريقنا هنا لمساعدتك في المواعيد والاستفسارات.'
              )}
            </p>

            <div className="contact-team-list">

              {phoneNumbers.map((phone,index)=>(
                <a
                  key={`phone-${index}`}
                  href={contactLink(
                    phone,
                    index===0?'telephone':'telephone2'
                  )}
                  className="contact-team-link"
                >
                  {phone}
                </a>
              ))}

              {email&&(
                <a
                  href={contactLink(email,'email')}
                  className="contact-team-link"
                >
                  {email}
                </a>
              )}

            </div>

            {!phoneNumbers.length&&!email&&(
              <p className="content-text">
                {t(
                  'Please contact our reception team for assistance.',
                  'يرجى التواصل مع فريق الاستقبال للحصول على المساعدة.'
                )}
              </p>
            )}

          </div>
        )}

        {current.type==='social'&&(
          <div className="contact-page-content">

            <p className="content-text">
              {t(
                'Follow us and stay connected with our clinic.',
                'تابعونا وابقوا على تواصل مع مركزنا.'
              )}
            </p>

            <div className="contact-icons">
              {socialLinks.map(item=>
                contactIcon(item.key,item.value!)
              )}
            </div>

            {!socialLinks.length&&(
              <p className="content-text">
                {t(
                  'Our social media links will be available soon.',
                  'ستتوفر روابط التواصل الاجتماعي قريباً.'
                )}
              </p>
            )}

          </div>
        )}

      </>
    );
  }

  // Page status
  if(!['welcome','language','home'].includes(screen)&&loaded&&!error){
    status=t(
      `${page+1} / ${totalPages} · Clinic information`,
      `${page+1} / ${totalPages} · معلومات المركز`
    );
  }

  // MAIN RENDER
  return (
    <div className="visitor-app">

      <div className="device">

        {!['welcome','language'].includes(screen)&&(
          <header className="header">

            <div className="brand-ribbon">

              <img
                src="/media/logo_glossy_original_colors.png"
                alt="Dr. Ashish Bhola Dermatology Center"
                className="brand-logo"
              />

            </div>

            <div className="header-right">

              <button
                className="language"
                onClick={()=>go('language')}
              >
                <span>English / العربية</span>
              </button>

            </div>

          </header>
        )}

        <main
          ref={mainRef}
          className={`stage stage-${screen}`}
          key={screen+page}
          aria-live="polite"
        >

          {body}

          {/* NEXT BUTTON - ABOUT US AND FIND US */}

          {(screen==='about'||screen==='contact')&&totalPages>1&&(
            <div className="page-navigation">

              <button
                onClick={()=>{
                  setPosition(p=>({
                    ...p,
                    page:Math.min(p.page+1,totalPages-1)
                  }));
                }}
                disabled={page>=totalPages-1}
              >
                {t('Next →','التالي ←')}
              </button>

            </div>
          )}

        </main>

        {!['welcome','language'].includes(screen)&&(
          <footer className="footer">

            <div className="footer-actions">

              <button onClick={back}>
                {t('← Back','عودة →')}
              </button>

              {[
                {label:t('Home','الرئيسية'),screen:'home'},
                {label:t('Treatments','العلاجات'),screen:'categories'},
                {label:t('Medical Team','الفريق الطبي'),screen:'doctors'},
                {label:t('About Us','من نحن'),screen:'about'},
                {label:t('Offers','العروض'),screen:'packages'},
                {label:t('Find Us','موقعنا'),screen:'contact'}
              ].map(menu=>(
                <button
                  key={menu.screen}
                  onClick={()=>go(menu.screen as Screen)}
                  className={screen===menu.screen?'nav-active':''}
                  aria-current={
                    screen===menu.screen?'page':undefined
                  }
                >
                  {menu.label}
                </button>
              ))}

            </div>

          </footer>
        )}

      </div>

    </div>
  );
}
