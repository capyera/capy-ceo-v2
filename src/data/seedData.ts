import { Project, Category, Task } from '../types/ceo';

export const initialProjects: Project[] = [
  {
    id: 'spring-collection',
    name: 'Spring Collection',
    emoji: '🌸',
    color: 'pink',
    description: 'Cappy Goes to Japan - Spring Collection Launch',
    due_date: '2026-02-28',
    priority: 'high',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'finance',
    name: 'Finance',
    emoji: '💰',
    color: 'green',
    description: 'Banking, credit lines, and financial tools',
    priority: 'high',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'operations',
    name: 'Operations',
    emoji: '📦',
    color: 'amber',
    description: 'Inventory, Amazon, logistics, fulfillment',
    priority: 'medium',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'creatives',
    name: 'Creatives',
    emoji: '🎨',
    color: 'purple',
    description: 'Creative team, hiring, content production',
    priority: 'high',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ai-dashboards',
    name: 'AI / Dashboards',
    emoji: '🤖',
    color: 'blue',
    description: 'AI tools and dashboard development',
    priority: 'medium',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'personal-branding',
    name: 'Personal Branding',
    emoji: '🙋',
    color: 'yellow',
    description: 'Twitter/X and personal brand building',
    priority: 'low',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'organic-content',
    name: 'Organic Content Team',
    emoji: '📱',
    color: 'teal',
    description: 'Organic content strategy and hiring',
    priority: 'medium',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dessert-collection',
    name: 'Dessert Collection',
    emoji: '🍰',
    color: 'orange',
    description: 'Dessert Collection Campaign Planning',
    priority: 'high',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const initialCategories: Category[] = [
  // Spring Collection
  { id: 'sc-social', project_id: 'spring-collection', name: 'Social Media', order: 1, created_at: new Date().toISOString() },
  { id: 'sc-banners', project_id: 'spring-collection', name: 'Banners & Creatives', order: 2, created_at: new Date().toISOString() },
  { id: 'sc-products', project_id: 'spring-collection', name: 'Products', order: 3, created_at: new Date().toISOString() },
  { id: 'sc-email', project_id: 'spring-collection', name: 'Email Marketing', order: 4, created_at: new Date().toISOString() },
  { id: 'sc-video', project_id: 'spring-collection', name: 'Video Ads', order: 5, created_at: new Date().toISOString() },
  { id: 'sc-landing', project_id: 'spring-collection', name: 'Landing Pages & Offers', order: 6, created_at: new Date().toISOString() },
  
  // Finance
  { id: 'fin-banking', project_id: 'finance', name: 'Banking', order: 1, created_at: new Date().toISOString() },
  { id: 'fin-tools', project_id: 'finance', name: 'Financial Tools', order: 2, created_at: new Date().toISOString() },
  { id: 'fin-compliance', project_id: 'finance', name: 'Compliance', order: 3, created_at: new Date().toISOString() },
  
  // Operations
  { id: 'ops-inventory', project_id: 'operations', name: 'Inventory', order: 1, created_at: new Date().toISOString() },
  { id: 'ops-amazon', project_id: 'operations', name: 'Amazon', order: 2, created_at: new Date().toISOString() },
  { id: 'ops-logistics', project_id: 'operations', name: 'Logistics', order: 3, created_at: new Date().toISOString() },
  { id: 'ops-fulfillment', project_id: 'operations', name: 'Fulfillment', order: 4, created_at: new Date().toISOString() },
  { id: 'ops-packaging', project_id: 'operations', name: 'Packaging', order: 5, created_at: new Date().toISOString() },
  { id: 'ops-wholesale', project_id: 'operations', name: 'Wholesale / B2B', order: 6, created_at: new Date().toISOString() },
  
  // Creatives
  { id: 'cr-hiring', project_id: 'creatives', name: 'Hiring', order: 1, created_at: new Date().toISOString() },
  { id: 'cr-briefs', project_id: 'creatives', name: 'Team Briefs', order: 2, created_at: new Date().toISOString() },
  { id: 'cr-production', project_id: 'creatives', name: 'Content Production', order: 3, created_at: new Date().toISOString() },
  { id: 'cr-future', project_id: 'creatives', name: 'Future Planning', order: 4, created_at: new Date().toISOString() },
  
  // AI / Dashboards
  { id: 'ai-tools', project_id: 'ai-dashboards', name: 'Team Tools', order: 1, created_at: new Date().toISOString() },
  { id: 'ai-inventory', project_id: 'ai-dashboards', name: 'Inventory', order: 2, created_at: new Date().toISOString() },
  
  // Personal Branding
  { id: 'pb-twitter', project_id: 'personal-branding', name: 'Twitter/X', order: 1, created_at: new Date().toISOString() },
  
  // Organic Content
  { id: 'oc-tools', project_id: 'organic-content', name: 'Tools', order: 1, created_at: new Date().toISOString() },
  { id: 'oc-hiring', project_id: 'organic-content', name: 'Hiring', order: 2, created_at: new Date().toISOString() },
  
  // Dessert Collection
  { id: 'dc-campaign', project_id: 'dessert-collection', name: 'Campaign', order: 1, created_at: new Date().toISOString() },
  { id: 'dc-creatives', project_id: 'dessert-collection', name: 'Creatives', order: 2, created_at: new Date().toISOString() },
];

export const initialTasks: Task[] = [
  // Spring Collection - Social Media
  { id: 't1', project_id: 'spring-collection', category_id: 'sc-social', title: 'Get edited images from Chia Yee', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't2', project_id: 'spring-collection', category_id: 'sc-social', title: 'Pick images to post', status: 'todo', priority: 'high', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't3', project_id: 'spring-collection', category_id: 'sc-social', title: 'Request additional edits from Chia Yee', status: 'todo', priority: 'medium', order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Spring Collection - Banners
  { id: 't4', project_id: 'spring-collection', category_id: 'sc-banners', title: 'Follow up with Maverick: Banner progress', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't5', project_id: 'spring-collection', category_id: 'sc-banners', title: 'Follow up with Maverick: Creative improvements', status: 'todo', priority: 'medium', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Spring Collection - Products
  { id: 't6', project_id: 'spring-collection', category_id: 'sc-products', title: 'Create evergreen products (duplicate from CRO agency)', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't7', project_id: 'spring-collection', category_id: 'sc-products', title: "Create VIP products (duplicate from Valentine's Day)", status: 'todo', priority: 'high', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Spring Collection - Email
  { id: 't8', project_id: 'spring-collection', category_id: 'sc-email', title: 'Review final emails from email agency', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Spring Collection - Video
  { id: 't9', project_id: 'spring-collection', category_id: 'sc-video', title: 'Len: Finish video ads (Tue-Wed)', status: 'todo', priority: 'high', assignee: 'Len', due_date: '2026-02-25', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Spring Collection - Landing Pages
  { id: 't10', project_id: 'spring-collection', category_id: 'sc-landing', title: 'Decide landing page strategy for 10" plushies', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't11', project_id: 'spring-collection', category_id: 'sc-landing', title: 'Decide landing page strategy for bag charms', status: 'todo', priority: 'high', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't12', project_id: 'spring-collection', category_id: 'sc-landing', title: 'Decide offer for bag charms', status: 'todo', priority: 'high', order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Finance - Banking
  { id: 't13', project_id: 'finance', category_id: 'fin-banking', title: 'Change Shopify payout → Mercury Bank', status: 'todo', priority: 'high', due_date: '2026-02-22', notes: 'TODAY!', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't14', project_id: 'finance', category_id: 'fin-banking', title: 'Airwallex meeting — credit lines', status: 'todo', priority: 'medium', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't15', project_id: 'finance', category_id: 'fin-banking', title: 'Follow up: Parker Bank status', status: 'todo', priority: 'medium', order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't16', project_id: 'finance', category_id: 'fin-banking', title: 'Follow up: Chase Bank credit status', status: 'todo', priority: 'medium', order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Finance - Tools
  { id: 't17', project_id: 'finance', category_id: 'fin-tools', title: 'Educate Chia Yee on Final Loop workflow', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Finance - Compliance
  { id: 't18', project_id: 'finance', category_id: 'fin-compliance', title: 'Sales tax software meeting', status: 'todo', priority: 'low', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Operations - Inventory
  { id: 't19', project_id: 'operations', category_id: 'ops-inventory', title: 'Tell Chia Yee: Order 3x kids hoodies', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Operations - Amazon
  { id: 't20', project_id: 'operations', category_id: 'ops-amazon', title: 'Follow up: Kid safety test results', status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't21', project_id: 'operations', category_id: 'ops-amazon', title: 'Get products with labels attached', status: 'todo', priority: 'medium', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't22', project_id: 'operations', category_id: 'ops-amazon', title: 'Create Amazon product listings', status: 'todo', priority: 'medium', order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Operations - Logistics
  { id: 't23', project_id: 'operations', category_id: 'ops-logistics', title: 'Chia Yee: Research freight forwarders', status: 'todo', priority: 'medium', assignee: 'Chia Yee', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't24', project_id: 'operations', category_id: 'ops-logistics', title: 'Share freight forwarder contacts', status: 'todo', priority: 'medium', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Operations - Fulfillment
  { id: 't25', project_id: 'operations', category_id: 'ops-fulfillment', title: 'Email Tando Fulfillment — ending partnership', status: 'todo', priority: 'medium', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Operations - Packaging
  { id: 't26', project_id: 'operations', category_id: 'ops-packaging', title: 'Plushie barcode tag — find design references', status: 'todo', priority: 'low', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Operations - Wholesale
  { id: 't27', project_id: 'operations', category_id: 'ops-wholesale', title: "Review Catherine's B2B/wholesale info", status: 'todo', priority: 'low', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Creatives - Hiring
  { id: 't28', project_id: 'creatives', category_id: 'cr-hiring', title: 'Senior Graphic Designer interview (Monday)', status: 'todo', priority: 'high', due_date: '2026-02-23', notes: 'Passion 8/10, Creativity 8.5/10, Skill 5/10. Salary 5.5K.', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't29', project_id: 'creatives', category_id: 'cr-hiring', title: 'Post organic content creator job', status: 'todo', priority: 'medium', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Creatives - Team Briefs
  { id: 't30', project_id: 'creatives', category_id: 'cr-briefs', title: 'Brief Maverick: Unicorn collection key visual', status: 'todo', priority: 'high', due_date: '2026-02-23', assignee: 'Maverick', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't31', project_id: 'creatives', category_id: 'cr-briefs', title: 'Brief Jared: Evergreen Creatives', status: 'todo', priority: 'high', due_date: '2026-02-23', assignee: 'Jared', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't32', project_id: 'creatives', category_id: 'cr-briefs', title: 'Talk to Len → brief for photo editor freelancer', status: 'todo', priority: 'high', due_date: '2026-02-24', order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't33', project_id: 'creatives', category_id: 'cr-briefs', title: 'IP Illustrator: New social formats + Loom video', status: 'todo', priority: 'medium', order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Creatives - Production
  { id: 't34', project_id: 'creatives', category_id: 'cr-production', title: "Review Mika's UGC videos + test", status: 'todo', priority: 'high', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't35', project_id: 'creatives', category_id: 'cr-production', title: 'Len: Photo shoot (Thu-Fri)', status: 'todo', priority: 'medium', due_date: '2026-02-27', assignee: 'Len', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't36', project_id: 'creatives', category_id: 'cr-production', title: 'Plan Fruit Stall footage → video assets', status: 'todo', priority: 'medium', order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Creatives - Future
  { id: 't37', project_id: 'creatives', category_id: 'cr-future', title: 'March video production planning', status: 'todo', priority: 'low', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // AI - Tools
  { id: 't38', project_id: 'ai-dashboards', category_id: 'ai-tools', title: 'Build organic content dashboard', status: 'todo', priority: 'medium', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // AI - Inventory
  { id: 't39', project_id: 'ai-dashboards', category_id: 'ai-inventory', title: 'Finish forecasting methodology', status: 'todo', priority: 'medium', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Personal Branding
  { id: 't40', project_id: 'personal-branding', category_id: 'pb-twitter', title: 'Prepare 5 Twitter posts', status: 'todo', priority: 'low', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't41', project_id: 'personal-branding', category_id: 'pb-twitter', title: 'Talk to Leo', status: 'todo', priority: 'low', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Organic Content
  { id: 't42', project_id: 'organic-content', category_id: 'oc-tools', title: 'Build content research dashboard', status: 'todo', priority: 'medium', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 't43', project_id: 'organic-content', category_id: 'oc-hiring', title: 'Post organic content creator job', status: 'todo', priority: 'medium', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // AI/Dashboard - NEW
  { id: 't44', project_id: 'ai-dashboards', category_id: 'ai-tools', title: "Maverick's AI Week planning - Flora templates for ads", status: 'todo', priority: 'high', due_date: '2026-02-22', assignee: 'Maverick', order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Creatives - NEW  
  { id: 't45', project_id: 'creatives', category_id: 'cr-briefs', title: 'Unicorn Capybaras - KVs', status: 'todo', priority: 'high', due_date: '2026-02-22', order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  
  // Dessert Collection - NEW
  { id: 't46', project_id: 'dessert-collection', category_id: 'dc-campaign', title: 'Dessert Collection Campaign Brief', status: 'todo', priority: 'high', due_date: '2026-02-23', order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];
