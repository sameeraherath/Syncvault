/** Site-wide constants. Edit links here, not in components. */
export const SITE = {
  name: 'Syncvault',
  url: 'https://getsyncvault.com',
  title: 'Syncvault — Manage all your cloud files in one place. Only you hold the key.',
  description:
    'Free, open-source desktop app. Google Drive, OneDrive and Dropbox files together in one app — synced, organised and private.',
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
