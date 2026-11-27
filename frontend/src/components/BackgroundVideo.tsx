import {useCallback,useEffect,useRef,useState} from 'react';

type Props={
  src:string;
  type:string;
  poster:string;
  className:string;
  playLabel:string;
  loop?:boolean;
  onEnded?:()=>void;
};

// Background video that also works on iOS Safari.
// React only sets `muted` as a DOM property, never as an HTML attribute, and
// iOS decides whether a video may autoplay from the attribute. So the
// attributes are set explicitly and play() is called by hand. If the browser
// still blocks autoplay (e.g. iPhone Low Power Mode), a play button appears
// and the next tap on the page also starts playback.
export default function BackgroundVideo({
  src,
  type,
  poster,
  className,
  playLabel,
  loop=false,
  onEnded
}:Props){
  const ref=useRef<HTMLVideoElement>(null);
  const [blocked,setBlocked]=useState(false);
  const [failed,setFailed]=useState(false);

  const tryPlay=useCallback(()=>{
    const v=ref.current;
    if(!v)return;

    v.muted=true;
    v.defaultMuted=true;
    v.setAttribute('muted','');
    v.setAttribute('playsinline','');
    v.setAttribute('webkit-playsinline','');

    const p=v.play();
    if(p&&typeof p.then==='function'){
      p.then(()=>setBlocked(false)).catch((e:unknown)=>{
        if((e as {name?:string})?.name!=='AbortError')setBlocked(true);
      });
    }
  },[]);

  useEffect(()=>{
    tryPlay();
  },[src,tryPlay]);

  // Resume if iOS paused the video while the tab was in the background
  useEffect(()=>{
    const onVisible=()=>{
      const v=ref.current;
      if(!document.hidden&&v&&v.paused&&!v.ended)tryPlay();
    };
    document.addEventListener('visibilitychange',onVisible);
    return()=>document.removeEventListener('visibilitychange',onVisible);
  },[tryPlay]);

  // If autoplay was blocked, the next tap anywhere starts the video
  useEffect(()=>{
    if(!blocked)return;
    const retry=()=>tryPlay();
    window.addEventListener('touchend',retry,{once:true});
    window.addEventListener('click',retry,{once:true});
    return()=>{
      window.removeEventListener('touchend',retry);
      window.removeEventListener('click',retry);
    };
  },[blocked,tryPlay]);

  return (
    <>
      <video
        ref={ref}
        className={className}
        autoPlay
        muted
        loop={loop}
        playsInline
        preload="auto"
        poster={poster}
        onPlaying={()=>setBlocked(false)}
        onEnded={onEnded}
      >
        <source src={src} type={type} onError={()=>setFailed(true)}/>
      </video>

      {blocked&&!failed&&(
        <button
          type="button"
          className="video-play-fallback"
          aria-label={playLabel}
          onClick={e=>{
            e.stopPropagation();
            tryPlay();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M8 5v14l11-7z"/>
          </svg>
        </button>
      )}
    </>
  );
}
