// Racial slurs
const racialSlurs = [
    /n+[i1!]+[gq9]+[gq9]+[aeio3@]+r*/i,   // nigg@, n!gg@, nigg3r, n1gg3r, etc.
    /n+[i1!]+g+[aeio3@]+r*/i,              // nig@, n!ga, nigga, n1gga, n!gg@ (explicit g's)
    /n+[i1!]+[gq9]+[aeio3@]+r*/i,         // nig@, n!g@, nig3r, n1g3r, etc.
    /n[e3]+gr+[o0]+/i,                     // negro, n3gr0, etc.

    /n\W*[i1!]\W*[gq9]\W*[gq9]\W*[aeio3@]\W*r*/i,  // n i g g a, n-i-g-g-a, etc.

    /ch[i1!]nk/i,
    /g[o0]+[o0]+k/i,
    /sp[i1!]c/i,
    /w[e3]+tb+[a4]+ck/i,
    /b[e3]+[a4]+n[e3]+r/i,
    /p+[a4]+k+[i1!]/i,
    /r+[a4]+g+h+[e3]+[a4]+d/i,
    /s+[a4]+nd+n+[i1!]+g+/i,
    /c+[o0]+[o0]+n/i,
    /m+[o0]+nk+[e3]+y+/i, // When used as racial slur
    /p+[o0]+rch+m+[o0]+nk+/i,
    /s+p+[e3]+[a4]+r+ch+uck+/i,
    /j+[i1!]+g+[a4]+b+[o0]+/i,
    /ky+k+[e3]+/i,
];

// Nazi/extremist content
const naziContent = [
    /n+[a4]+z+[i1!]/i,
    /h+[i1!]+tl+[e3]+r/i,
    /f+[uü]+hr+[e3]+r/i,
    /s+[i1!]+[e3]+g+h+[e3]+[i1!]+l/i,
    /\b88\b/,
    /\b14\b.*\b88\b/,
    /\b1488\b/,
    /[h]+[e3]+[i1!]+l+.*h+[i1!]+tl+[e3]+r/i,
    /[a4]+d+[o0]+lf/i,
    /r+[e3]+[i1!]+ch+/i,
    /sw+[a4]+st+[i1!]+k+[a4]/i,
    /[a4]+r+y+[a4]+n/i,
    /wh+[i1!]+t+[e3]+.*s+[u]+pr+[e3]+m+/i,
    /wh+[i1!]+t+[e3]+.*p+[o0]+w+[e3]+r/i,
];

  //                NO BITCHES???
  //     ⠀⣞⢽⢪⢣⢣⢣⢫⡺⡵⣝⡮⣗⢷⢽⢽⢽⣮⡷⡽⣜⣜⢮⢺⣜⢷⢽⢝⡽⣝
  //     ⠸⡸⠜⠕⠕⠁⢁⢇⢏⢽⢺⣪⡳⡝⣎⣏⢯⢞⡿⣟⣷⣳⢯⡷⣽⢽⢯⣳⣫⠇
  //     ⠀⠀⢀⢀⢄⢬⢪⡪⡎⣆⡈⠚⠜⠕⠇⠗⠝⢕⢯⢫⣞⣯⣿⣻⡽⣏⢗⣗⠏⠀
  //     ⠀⠪⡪⡪⣪⢪⢺⢸⢢⢓⢆⢤⢀⠀⠀⠀⠀⠈⢊⢞⡾⣿⡯⣏⢮⠷⠁⠀⠀
  //     ⠀⠀⠀⠈⠊⠆⡃⠕⢕⢇⢇⢇⢇⢇⢏⢎⢎⢆⢄⠀⢑⣽⣿⢝⠲⠉⠀⠀⠀⠀
  //     ⠀⠀⠀⠀⠀⡿⠂⠠⠀⡇⢇⠕⢈⣀⠀⠁⠡⠣⡣⡫⣂⣿⠯⢪⠰⠂⠀⠀⠀⠀
  //     ⠀⠀⠀⠀⡦⡙⡂⢀⢤⢣⠣⡈⣾⡃⠠⠄⠀⡄⢱⣌⣶⢏⢊⠂⠀⠀⠀⠀⠀⠀
  //     ⠀⠀⠀⠀⢝⡲⣜⡮⡏⢎⢌⢂⠙⠢⠐⢀⢘⢵⣽⣿⡿⠁⠁⠀⠀⠀⠀⠀⠀⠀
  //     ⠀⠀⠀⠀⠨⣺⡺⡕⡕⡱⡑⡆⡕⡅⡕⡜⡼⢽⡻⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
  //     ⠀⠀⠀⠀⣼⣳⣫⣾⣵⣗⡵⡱⡡⢣⢑⢕⢜⢕⡝⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
  //     ⠀⠀⠀⣴⣿⣾⣿⣿⣿⡿⡽⡑⢌⠪⡢⡣⣣⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
  //     ⠀⠀⠀⡟⡾⣿⢿⢿⢵⣽⣾⣼⣘⢸⢸⣞⡟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
  //     ⠀⠀⠀⠀⠁⠇⠡⠩⡫⢿⣝⡻⡮⣒⢽⠋⠀⠀⠀⠀
  // ONlY PUSSIES GET THEIR FEELINGS HURT BY WORDS

// Combine all patterns
const allHateSpeechPatterns = [
    ...racialSlurs,
    ...naziContent
];

export function containsHateSpeech(message: string): boolean {
    if (!message || typeof message !== 'string') {
        return false;
    }

    // Normalize the message
    const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();

    for (const pattern of allHateSpeechPatterns) {
        if (pattern.test(normalized)) {
            return true;
        }
    }

    if (normalized.includes('white') && normalized.includes('power')) {
        return true;
    }
    if (normalized.includes('gas') && normalized.includes('jew')) {
        return true;
    }
    if (normalized.includes('lynch')) {
        return true;
    }

    return false;
}

export function getHateSpeechReason(message: string): string {
    const normalized = message.toLowerCase();

    // Check pattern categories
    for (const pattern of racialSlurs) {
        if (pattern.test(normalized)) {
            return 'Racial slurs';
        }
    }

    for (const pattern of naziContent) {
        if (pattern.test(normalized)) {
            return 'Nazi/extremist content';
        }
    }
    return 'Hate speech detected';
}

const profanityPatterns = [
    // fuck
    /\b(f+[u\*@#$%üù]+c+k+|f+[\*@#$%]+c+k+|f+u+[\*@#$%]+k+|f+[\*@#$%]+[\*@#$%]+k+)\b/gi,
    /\b(f+[u\*@#$%üù]+c+k+[i1!]+n+g+|f+[\*@#$%]+c+k+[i1!]+n+g+)\b/gi,
    /\b(f+[u\*@#$%üù]+c+k+[e3@]+d+|f+[\*@#$%]+c+k+[e3@]+d+)\b/gi,
    
    // shit
    /\b([s$5]+h+[i1!]+t+|[s$5]+[\*@#$%]+[i1!]+t+|[s$5]+h+[\*@#$%]+t+)\b/gi,
    /\b([s$5]+h+[i1!]+t+t+y+|[s$5]+[\*@#$%]+[i1!]+t+t+y+)\b/gi,
    
    // asshole
    /\b([a4@]+[s$5]+[s$5]+h+[o0]+l+[e3@]+|[a4@]+[\*@#$%]+[s$5]+h+[o0]+l+[e3@]+)\b/gi,
    /\b([a4@]+[s$5]+[s$5]+|[a4@]+[\*@#$%]+[s$5]+)\b/gi,
    
    // bitch
    /\b(b+[i1!]+t+c+h+|b+[\*@#$%]+t+c+h+|b+[i1!]+[\*@#$%]+c+h+)\b/gi,
    /\b(b+[i1!]+t+c+h+[e3@]+[s$5]+|b+[\*@#$%]+t+c+h+[e3@]+[s$5]+)\b/gi,
    
    // damn
    /\b(d+[a4@]+m+n+|d+[\*@#$%]+m+n+)\b/gi,
    /\b(d+[a4@]+m+m+[i1!]+t+|d+[\*@#$%]+m+m+[i1!]+t+)\b/gi,
    
    // hell
    /\b(h+[e3@]+l+l+|h+[\*@#$%]+l+l+)\b/gi,
    
    // crap and cunt
    /\b(c+r+[a4@]+p+|c+[\*@#$%]+[a4@]+p+)\b/gi,
    /\b(c+[u\*@#$%üù]+n+t+|c+[\*@#$%]+n+t+)\b/gi,
    
    // piss
    /\b(p+[i1!]+[s$5]+[s$5]+|p+[\*@#$%]+[s$5]+[s$5]+)\b/gi,
    /\b(p+[i1!]+[s$5]+[s$5]+[e3@]+d+|p+[\*@#$%]+[s$5]+[s$5]+[e3@]+d+)\b/gi,
    
    // Additional profanity with better substitutions
    /\b(w+h+[o0]+r+[e3@]+|w+[\*@#$%]+[o0]+r+[e3@]+)\b/gi,
    /\b([s$5]+l+[u\*@#$%üù]+t+|[s$5]+[\*@#$%]+[u\*@#$%üù]+t+)\b/gi,
    /\b(b+[a4@]+[s$5]+t+[a4@]+r+d+|b+[\*@#$%]+[s$5]+t+[a4@]+r+d+)\b/gi,
    /\b(d+[i1!]+c+k+|d+[\*@#$%]+c+k+)\b/gi,
    /\b(c+[o0]+c+k+|c+[\*@#$%]+c+k+)\b/gi,
    /\b(p+r+[i1!]+c+k+|p+[\*@#$%]+[i1!]+c+k+)\b/gi,
    
    // Leetspeak patterns
    /\bf+4+c+k+/gi,
    /\bf+[u\*@#$%üù]+c+k+/gi,
    /\b[s$5]+h+1+t+/gi,
    /\bb+1+t+c+h+/gi,
    /\b[a4@]+[s$5]+[s$5]+h+0+l+[e3@]+/gi,
    
    // Word combinations
    /f+[u\*@#$%üù]+c+k+b+[i1!]+t+c+h+/gi,      // fuckbitch
    /f+[u\*@#$%üù]+c+k+y+[o0]+[u\*@#$%üù]+/gi,  // fuckyou
    /b+[i1!]+t+c+h+[a4@]+[s$5]+[s$5]+/gi,       // bitchass
    /[s$5]+h+[i1!]+t+h+[e3@]+[a4@]+d+/gi,       // shithead
    /d+[i1!]+c+k+h+[e3@]+[a4@]+d+/gi,           // dickhead
    /[a4@]+[s$5]+[s$5]+h+[o0]+l+[e3@]+[s$5]+/gi, // assholes

    /f+\W*[u\*@#$%üù]+\W*c+\W*k+/gi,           // f*u*c*k, f-u-c-k, etc.
    /[s$5]+\W*h+\W*[i1!]+\W*t+/gi,              // s*h*i*t, s-h-i-t, etc.
    /b+\W*[i1!]+\W*t+\W*c+\W*h+/gi,             // b*i*t*c*h, b-i-t-c-h, etc.
    
    /what+.*the+.*f+[u\*@#$%üù]+c+k+/gi,        // whatthefuck
    /go+.*f+[u\*@#$%üù]+c+k+.*yourself/gi,      // gofuckyourself
    /f+[u\*@#$%üù]+c+k+.*off/gi,                // fuckoff
];
// backup
const simpleProfanityWords = [
    'fuck', 'shit', 'bitch', 'asshole', 'damn', 'hell', 'crap', 'cunt', 
    'piss', 'whore', 'slut', 'bastard', 'dick', 'cock', 'prick',
    'fck', 'sht', 'btch', 'dmn', 'fuk', 'shyt', 'dck', 'fack', 'killyourself',

    'fuckbitch', 'fuckyou', 'bitchass', 'shithead', 'dickhead', 'fuckoff',
    'motherfucker', 'bullshit', 'horseshit', 'chickenshit', 'dipshit',

    'f4ck', 'sh1t', 'b1tch', 'a55hole', 'h3ll', 'cr4p', 'd1ck', 'c0ck',
    '$hit', 'sh!t', 'f*ck', 'b!tch', 'a$$', 'd@mn', 'h@ll', 'pr!ck', 'kys', 'kill your self'
];

const allProfanityPatterns = [
    ...profanityPatterns
];
// ⠉⠉⠉⣿⡿⠿⠛⠋⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⣻⣩⣉⠉⠉
// ⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⢀⣀⣀⣀⣀⣀⣀⡀⠄⠄⠉⠉⠄⠄⠄
// ⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⣠⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣤⠄⠄⠄⠄
// ⠄⠄⠄⠄⠄⠄⠄⠄⠄⢤⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀⠄⠄⠄
// ⡄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠉⠄⠉⠉⠉⣋⠉⠉⠉⠉⠉⠉⠉⠉⠙⠛⢷⡀⠄⠄
// ⣿⡄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠠⣾⣿⣷⣄⣀⣀⣀⣠⣄⣢⣤⣤⣾⣿⡀⠄
// ⣿⠃⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⣹⣿⣿⡿⠿⣿⣿⣿⣿⣿⣿⣿⣿⢟⢁⣠
// ⣿⣿⣄⣀⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠉⠉⣉⣉⣰⣿⣿⣿⣿⣷⣥⡀⠉⢁⡥⠈
// ⣿⣿⣿⢹⣇⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠒⠛⠛⠋⠉⠉⠛⢻⣿⣿⣷⢀⡭⣤⠄
// ⣿⣿⣿⡼⣿⠷⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⢀⣀⣠⣿⣟⢷⢾⣊⠄⠄
// ⠉⠉⠁⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠈⣈⣉⣭⣽⡿⠟⢉⢴⣿⡇⣺⣿⣷
// ⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠄⠁⠐⢊⣡⣴⣾⣥⣿⣿⣿

export function containsProfanity(message: string): boolean {
    if (!message || typeof message !== 'string') {
        return false;
    }

    // Multiple normalization passes for thorough checking
    const normalized = message.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Remove common separators and special characters for backup check
    const stripped = message.toLowerCase()
        .replace(/[\s\-_\*@#$%\.\,\!\?]+/g, '')
        .replace(/[0o]/g, 'o')
        .replace(/[1il\!]/g, 'i')
        .replace(/[3e]/g, 'e')
        .replace(/[4a@]/g, 'a')
        .replace(/[5s\$]/g, 's')
        .replace(/[7t]/g, 't')
        .replace(/[9g]/g, 'g');

    // Primary regex pattern check
    for (const pattern of allProfanityPatterns) {
        if (pattern.test(normalized)) {
            return true;
        }
    }

    // Backup simple string contains check
    for (const word of simpleProfanityWords) {
        if (normalized.includes(word) || stripped.includes(word)) {
            return true;
        }
    }

    // Additional backup checks for partial matches
    const words = normalized.split(/\s+/);
    for (const word of words) {
        for (const profanity of simpleProfanityWords) {
            if (word.includes(profanity) && word.length <= profanity.length + 3) {
                return true;
            }
        }
    }

    return false;
}