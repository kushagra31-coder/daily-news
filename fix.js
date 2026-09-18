const fs = require('fs');
let code = fs.readFileSync('frontend/components/BreakingBanner.tsx', 'utf-8');
code = code.replace(/  \/\/ Only show if article is less than 2 hours old\n  const ageHours = differenceInHours\(new Date\(\), parseISO\(publishedAt\)\)\n  if \(ageHours >= 2\) return null/, '');
code = code.replace(/import \{ differenceInHours, parseISO \} from 'date-fns'/, '');
fs.writeFileSync('frontend/components/BreakingBanner.tsx', code, 'utf-8');
