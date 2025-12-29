export interface ServiceDefinition {
  id: string; // The service ID used in our API (e.g., 'gmail')
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const SERVICES_METADATA: ServiceDefinition[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send and receive emails, manage drafts and labels.',
    icon: 'https://img.icons8.com/color/48/gmail-new.png',
    color: 'text-red-500',
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Create, read, and edit spreadsheets dynamically.',
    icon: 'https://img.icons8.com/color/48/google-sheets.png',
    color: 'text-green-600',
  },
  {
    id: 'docs',
    name: 'Google Docs',
    description: 'Create, read, and edit documents dynamically.',
    icon: 'https://img.icons8.com/color/48/google-docs.png',
    color: 'text-purple-600',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Upload, download, and manage files in the cloud.',
    icon: 'https://img.icons8.com/color/48/google-drive.png',
    color: 'text-blue-500',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Manage repositories, issues, pull requests and more.',
    icon: 'https://img.icons8.com/3d-fluency/94/github-logo.png',
    color: 'text-slate-900',
  }
];
