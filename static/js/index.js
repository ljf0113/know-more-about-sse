'use strict';

function connectSSE() {
  if (window.EventSource) {
    const source = new EventSource('http://localhost:3000/test');

    source.addEventListener('open', () => {
      console.log('Connected');
    }, false);

    source.addEventListener('message', e => {
      console.log(e.data);
    }, false);

    source.addEventListener('pause', () => {
      source.close();
    }, false);
  } else {
    console.error('Your browser doesn\'t support SSE');
  }
}

connectSSE();