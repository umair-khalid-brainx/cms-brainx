import { apiUpload } from './api';
import { getSession } from './auth';

export async function uploadMedia(file: File): Promise<{ url: string }> {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not signed in');

  const body = new FormData();
  body.append('file', file);
  return apiUpload<{ url: string }>('/media', body, token);
}
