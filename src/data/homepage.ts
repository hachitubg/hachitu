export interface HomepageTechItem {
  title: string
  value: string
  tone: 'coral' | 'amber' | 'sky'
}

export interface HomepageProjectLink {
  name: string
  url: string
}

export const homepageTechItems: HomepageTechItem[] = [
  {
    title: 'Frontend',
    value: 'Vue 3, TypeScript, Tailwind CSS v4',
    tone: 'coral',
  },
  {
    title: 'Backend & API',
    value: 'Node.js, Socket.IO, OpenRouter API',
    tone: 'sky',
  },
  {
    title: 'Realtime State',
    value: 'Room state trong memory, không dùng database mặc định',
    tone: 'amber',
  },
]

export const homepageProjectLinks: HomepageProjectLink[] = [
  { name: 'comcogiang.io.vn', url: 'https://comcogiang.io.vn/' },
  { name: 'halife.vn', url: 'https://halife.vn/' },
  { name: 'mgf.com.vn', url: 'https://mgf.com.vn/' },
  { name: 'quangminhtna.vn', url: 'https://quangminhtna.vn/' },
  { name: 'greenq.vn', url: 'https://greenq.vn/' },
]

export const homepageSourceTribute = {
  name: 'J2TEAM vibe',
  url: 'https://github.com/J2TEAM/vibe.j2team.org',
  description:
    'HACHITU được tham khảo cấu trúc source code, cách tổ chức launcher và nhiều pattern UI từ dự án cộng đồng này.',
}
