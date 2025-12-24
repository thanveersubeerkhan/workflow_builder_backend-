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
    icon: 'Mail',
    color: 'text-red-500',
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Create, read, and edit spreadsheets dynamically.',
    icon: 'FileSpreadsheet',
    color: 'text-green-600',
  },
  {
    id: 'docs',
    name: 'Google Docs',
    description: 'Create, read, and edit documents dynamically.',
    icon: 'FileText',
    color: 'text-purple-600',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Upload, download, and manage files in the cloud.',
    icon: 'HardDrive',
    color: 'text-blue-500',
  }
];
