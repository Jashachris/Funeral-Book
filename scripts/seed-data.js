const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

const seedData = {
  records: [
    {
      id: 1,
      name: 'John Doe',
      note: 'Beloved father and grandfather. 1945-2023.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      name: 'Jane Smith',
      note: 'Loving mother, devoted teacher. 1950-2024.',
      createdAt: new Date().toISOString(),
    },
  ],
  users: [
    {
      id: 1,
      username: 'demo',
      password: '$2a$10$demo.hash.placeholder',
      private: false,
      createdAt: new Date().toISOString(),
    },
  ],
  posts: [
    {
      id: 1,
      userId: 1,
      title: 'In Loving Memory',
      body: 'A tribute to a wonderful life.',
      videoUrl: '',
      tags: ['memory', 'tribute'],
      mentions: [],
      createdAt: new Date().toISOString(),
    },
  ],
  chat: [],
  sessions: [],
  live: {},
  blocks: [],
  reports: [],
  followRequests: [],
  followers: [],
  memorials: [],
};

console.log('Seeding data to', DATA_FILE);
fs.writeFileSync(DATA_FILE, JSON.stringify(seedData, null, 2), 'utf8');
console.log('Seed data created successfully!');
console.log('- 2 sample records');
console.log('- 1 demo user (username: demo)');
console.log('- 1 sample post');
