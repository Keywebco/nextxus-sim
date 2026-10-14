/* NX Talk: one reusable voice + send control. Usage: NXTalk.attach({form,textarea,send,health}) */
(function(){
  'use strict';
  function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x)e.textContent=x;return e;}
  function attach(o){
    var ta=o.textarea,form=o.form,send=o.send;
    if(!ta||!form||ta.getAttribute('data-nxt'))return;
    ta.setAttribute('data-nxt','1');
    var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    var box=el('div','nxt-box');
    var wake=el('div','nxt-wake');wake.setAttribute('role','status');
    wake.textContent='The Sim is waking up. This can take about 20 seconds the first time. Please wait, then try again.';
    var mic=el('button','nxt-mic');mic.type='button';mic.setAttribute('aria-pressed','false');
    var how=el('p','nxt-how');
    var state=el('p','nxt-state');state.setAttribute('aria-live','polite');
    box.appendChild(mic);box.appendChild(how);box.appendChild(state);
    ta.parentNode.insertBefore(wake,ta);
    ta.parentNode.insertBefore(box,ta);
    if(send){send.classList.add('nxt-send');send.textContent='SEND';send.setAttribute('aria-label','Send your message');}
    var rec=null,on=false,base='';
    function setIdle(){on=false;mic.setAttribute('aria-pressed','false');mic.textContent='\uD83C\uDF99  TAP TO TALK';}
    if(!SR){
      mic.disabled=true;mic.textContent='VOICE NOT AVAILABLE HERE';
      how.innerHTML='<b>This browser cannot take voice.</b> Please type your message in the box below, then press the green <b>SEND</b> button. For voice, open this page in Chrome.';
    }else{
      setIdle();
      how.innerHTML='<b>How to talk:</b> 1. Tap the gold button. 2. If asked, tap <b>Allow</b> for the microphone. 3. Speak. Your words appear in the box below. 4. Tap the button again to stop. 5. Press the green <b>SEND</b> button.';
      mic.addEventListener('click',function(){
        if(on){try{rec.stop();}catch(e){}return;}
        rec=new SR();rec.lang='en-US';rec.interimResults=true;rec.continuous=true;
        base=ta.value?ta.value.replace(/\s+$/,'')+' ':'';
        rec.onstart=function(){on=true;mic.setAttribute('aria-pressed','true');mic.textContent='\u25CF LISTENING... TAP TO STOP';state.textContent='Listening. Speak now.';};
        rec.onresult=function(ev){var s='';for(var i=0;i<ev.results.length;i++)s+=ev.results[i][0].transcript;ta.value=base+s;ta.dispatchEvent(new Event('input',{bubbles:true}));};
        rec.onerror=function(ev){var m={'not-allowed':'Microphone is blocked. Tap the lock icon in the address bar, allow Microphone, then tap the gold button again.','service-not-allowed':'Microphone is blocked. Allow it in your browser settings, then try again.','no-speech':'I did not hear anything. Tap the gold button and speak.','audio-capture':'No microphone found on this device.','network':'Voice needs an internet connection. Please type instead.'};state.textContent=m[ev.error]||('Voice problem: '+ev.error+'. Please type instead.');};
        rec.onend=function(){setIdle();if(ta.value.trim()&&/Listening/.test(state.textContent))state.textContent='Done. Check the words, then press the green SEND button.';};
        try{rec.start();}catch(e){state.textContent='Could not start the microphone. Tap the gold button again.';}
      });
    }
    ta.addEventListener('input',function(){if(send)send.disabled=false;});
    /* wake-up notice: if the backend is slow to answer, say so plainly */
    if(o.health){
      var t0=Date.now(),shown=false,timer=setTimeout(function(){shown=true;wake.classList.add('on');},2500);
      fetch(o.health).then(function(r){return r.json();}).then(function(){clearTimeout(timer);if(shown){wake.textContent='The Sim is awake. You can send now.';setTimeout(function(){wake.classList.remove('on');},4000);}}).catch(function(){clearTimeout(timer);wake.classList.add('on');wake.textContent='The Sim did not answer. Please try again in a minute.';});
    }
  }
  window.NXTalk={attach:attach};
})();
