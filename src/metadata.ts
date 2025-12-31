export interface ServiceDefinition {
  id: string; // The service ID used in our API (e.g., 'gmail')
  name: string;
  description: string;
  icon: string;
  color: string;
  category?: string;
}

export const SERVICES_METADATA: ServiceDefinition[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send and receive emails, manage drafts and labels.',
    icon: 'https://img.icons8.com/color/48/gmail-new.png',
    color: 'text-red-500',
    category: 'communication'
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Create, read, and edit spreadsheets dynamically.',
    icon: 'https://img.icons8.com/color/48/google-sheets.png',
    color: 'text-green-600',
    category: 'productivity'
  },
  {
    id: 'docs',
    name: 'Google Docs',
    description: 'Create, read, and edit documents dynamically.',
    icon: 'https://img.icons8.com/color/48/google-docs.png',
    color: 'text-purple-600',
    category: 'productivity'
  },
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Upload, download, and manage files in the cloud.',
    icon: 'https://img.icons8.com/color/48/google-drive.png',
    color: 'text-blue-500',
    category: 'storage'
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Manage repositories, issues, pull requests and more.',
    icon: 'https://img.icons8.com/3d-fluency/94/github-logo.png',
    color: 'text-slate-900',
    category: 'development'
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Send and receive emails via Microsoft Outlook.',
    icon: 'https://img.icons8.com/color/48/microsoft-outlook-2019.png',
    color: 'text-blue-500',
    category: 'communication'
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    description: 'Manage files and folders in OneDrive.',
    icon: 'https://img.icons8.com/?size=100&id=PnENrLMMW4eV&format=png&color=000000', // Assuming a standard icon URL
    color: 'text-blue-700', // Using a Tailwind CSS color class for consistency
    category: 'storage' // Assuming category based on description
  },
  {
    id: 'excel',
    name: 'Excel',
    description: 'Manage spreadsheets in Microsoft Excel.',
    icon: 'https://img.icons8.com/color/48/microsoft-excel-2019.png',
    color: 'text-green-600',
    category: 'productivity'
  },
  {
    id: 'word',
    name: 'Word',
    description: 'Create and edit documents in Microsoft Word.',
    icon: 'https://img.icons8.com/color/48/microsoft-word-2019.png',
    color: 'text-blue-700',
    category: 'productivity'
  }
];
