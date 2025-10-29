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
    return 'Hate speech detected';
}
