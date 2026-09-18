fetch('https://daily-vanish-worker.daily-vanish.workers.dev/api/news').then(r => r.json()).then(console.log).catch(console.error);
