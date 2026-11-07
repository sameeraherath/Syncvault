/** Site-wide constants. Edit links here, not in components. */
export const SITE = {
  name: 'Syncvault',
  url: 'https://getsyncvault.com',
  title: 'Syncvault — All your clouds in one place. Locked with your key.',
  description:
    'Free, open-source app that keeps your files in sync with Google Drive, OneDrive and Dropbox — and locks them on your computer first, so nobody else can look inside.',
  links: {
    // TODO(release): point at the Linux release page once the first build is published.
    download: '#download',
    // TODO(repo): set the public GitHub URL once the repository is published.
    source: '#community',
    translate: '#community',
    reportProblem: '#community',
    sponsor: '#community',
    tryBeta: '#community',
    community: '#community',
  },
} as const;
