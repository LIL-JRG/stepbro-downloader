// English is the source catalogue. Its shape (`Messages`) is the contract every
// other locale fills in; missing keys fall back to these values.
export const en = {
  nav: {
    donate: 'Donate',
  },
  lang: {
    choose: 'Choose language',
  },
  hero: {
    title: 'Download any video',
    subtitle: 'YouTube, TikTok, X, Instagram & more — MP4 or MP3, up to 4K',
    placeholder: 'Paste the video URL here…',
    paste: 'Paste from clipboard',
  },
  form: {
    best: 'Best',
    download: 'Download',
    downloading: 'Downloading…',
    cancel: 'Cancel',
  },
  usage: {
    left: '{remaining} of {limit} downloads left today',
    reached: 'Daily limit reached — resets tomorrow',
    tooLong: 'Video too long (max {hours}h)',
  },
  progress: {
    processing: 'Processing…',
  },
  result: {
    ready: 'Your download is ready',
    saveFile: 'Save file',
    thumbnail: 'Thumbnail',
    subtitles: 'Subtitles',
    view: 'View',
    hide: 'Hide',
    copy: 'Copy',
    copied: 'Copied',
    downloadSrt: 'Download .srt',
    download: 'Download',
    none: 'No subtitles available',
    another: 'Download another',
    auto: 'auto',
  },
  supporter: {
    have: 'Have a supporter key?',
    placeholder: 'SB-XXXX-XXXX-XXXX',
    apply: 'Apply',
    active: 'Supporter — unlimited downloads',
    invalid: 'Invalid or revoked key',
    remove: 'Remove',
    widget: 'Supporter',
    becomeTitle: 'Become a Supporter',
    becomeSubtitle: 'One-time support on Ko-fi unlocks everything, forever.',
    become: 'Become a Supporter',
    alreadyKey: 'Already have a key?',
    free: 'Free',
    fQuality: 'Video & audio downloads up to 4K',
    fExtras: 'Subtitles, thumbnails & MP3',
    fDaily: 'Downloads per day',
    fDailyFree: '{limit} / day',
    unlimited: 'Unlimited',
    fLength: 'Videos longer than {hours}h',
    fSupport: 'Support development',
    activateTitle: 'Activate your license',
    activateText:
      'We opened Ko-fi in a new tab. After you pay there, come back and enter the email you used — we’ll activate your license here.',
    emailPlaceholder: 'Payment email',
    activate: 'Activate',
    justPaid: 'Just paid? Wait a few seconds and try again.',
    keyTitle: 'License key',
    keyText: 'Enter your license key, or the Ko-fi payment email you used to recover it.',
    keyPlaceholder: 'SB-XXXX-XXXX-XXXX or email',
    submit: 'Submit',
    activeTitle: 'You’re a Supporter',
    activeText: 'Unlimited downloads and no duration cap. Thank you for the support!',
    yourKey: 'Your key — save it somewhere safe:',
    copy: 'Copy',
    close: 'Close',
    tiers: 'Licenses: 7-day · 30-day · 90-day · Lifetime',
    plan7d: '7-Day Full Access',
    plan30d: '30-Day Full Access',
    plan90d: '90-Day Full Access',
    planLifetime: 'Lifetime Membership — Full Access',
    expires: 'Expires {date}',
  },
  preview: {
    loading: 'Loading preview…',
  },
  disclaimer: {
    // {terms} is replaced by a link to /copyright when rendered.
    text: 'I confirm I have read and agree to the {terms} and will not download copyrighted content.',
    terms: 'copyright terms',
    report: 'Report copyrighted content',
    agree: 'I agree',
  },
  video: {
    formats: 'formats',
  },
  toast: {
    started: 'Download started',
    failed: 'Download failed',
    needUrl: 'Paste a video URL first',
    needConsent: 'Please accept the copyright terms first',
    limit: 'Daily download limit reached. Please try again tomorrow.',
    clipboard: 'Clipboard access is blocked by the browser',
    loadFail: 'Could not load video',
  },
  pills: {
    fast: 'Fast & free',
    quality: 'Up to 4K with audio',
    mp3: 'MP3 audio',
  },
  info: {
    title: 'The simplest way to save video & audio',
    intro:
      'stepbro downloader turns links from YouTube, TikTok, X, Instagram and thousands of other sites into a clean MP4 (up to 4K) or an MP3 audio file. MP4 plays on virtually every phone, laptop, TV and media app, so you never have to worry about compatibility. Paste a link, pick a quality, and download — no apps, no sign-ups and no pop-ups.',
    howTitle: 'How it works',
    steps: [
      { title: 'Copy the link', text: 'Grab the URL from your browser’s address bar or the Share menu in any app.' },
      { title: 'Paste & choose', text: 'Paste it above, pick MP4 or MP3, then a resolution (360p → 4K) or audio bitrate.' },
      { title: 'Download', text: 'Hit Download and your file arrives with audio. On mobile, keep the tab in front.' },
    ],
    whyTitle: 'Why people choose it',
    reasons: [
      { title: 'Fast & unlimited', text: 'No account and no limits — grab as many files as you want.' },
      { title: 'No ads, no clutter', text: 'A clean interface with no pop-ups or fake buttons.' },
      { title: 'Any device', text: 'Works on iPhone, Android, Windows, macOS and most TVs.' },
      { title: 'Always with audio', text: 'Video + audio are merged automatically into one file.' },
    ],
    formatsTitle: 'Supported formats & quality',
    formats: [
      { label: 'Video:', text: 'MP4, WebM or MKV — from 360p up to 2160p (4K) when the source offers it.' },
      { label: 'Audio:', text: 'MP3, M4A, AAC, Opus and more, at your chosen bitrate.' },
      { label: 'Compatibility:', text: 'MP4 works on iPhone, Android, Windows, macOS and most TVs and players.' },
      { label: 'Availability:', text: 'if a resolution is missing, the original simply wasn’t uploaded in that quality.' },
    ],
    tipsTitle: 'Tips & troubleshooting',
    tips: [
      { label: 'Missing 1080p/4K:', text: 'the source probably wasn’t uploaded at that resolution — try another quality.' },
      { label: 'Stuck on a download:', text: 'refresh, paste again and pick a different quality; disable aggressive ad/script blockers for this page.' },
      { label: 'Long videos:', text: 'keep the tab active on mobile and prefer a stable Wi-Fi connection.' },
    ],
    safetyTitle: 'Safety & legality',
    safety:
      'Use stepbro downloader for content you own or have permission to download. Respect each platform’s Terms of Service and the copyright laws in your region. We don’t encourage downloading copyrighted content without authorization.',
    faqTitle: 'Frequently asked questions',
    faq: [
      { q: 'Is it free and safe?', a: 'Yes — it’s free, ad-free and runs entirely in your browser. No sign-up or extra steps.' },
      { q: 'Why is there no sound at some qualities?', a: 'For a few videos a given resolution may be video-only. Pick MP4 here and audio is merged automatically; if a source track is missing, choose a nearby quality that includes audio.' },
      { q: 'Does it work on iPhone and Android?', a: 'Yes. On iPhone (Safari) use the download arrow and “Save to Files”. On Android, files land in your Downloads folder. No app or extension needed.' },
      { q: 'Can I download long videos?', a: 'Yes, though longer or higher-resolution files take more time and depend on your connection. Keep the tab active on mobile and prefer stable Wi-Fi.' },
      { q: 'Do I need to install anything?', a: 'No. Everything is browser-based: paste a link, pick a quality and download.' },
      { q: 'What about private or region-locked videos?', a: 'Private, members-only or geo-restricted content isn’t supported. Try a different link if access is limited.' },
    ],
  },
}

export type Messages = typeof en

// A locale may translate any subset of the catalogue; the rest falls back to English.
export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T
