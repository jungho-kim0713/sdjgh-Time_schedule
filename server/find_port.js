const { exec } = require('child_process');
exec('netstat -ano | findstr LISTEN', (err, stdout) => {
  console.log(stdout);
});
