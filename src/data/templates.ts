// Pre-built UI templates for quick insertion
export interface Template {
  id: string;
  name: string;
  category: 'forms' | 'navigation' | 'hero' | 'cards' | 'layout' | 'other';
  description: string;
  preview: string; // Preview description
  canvasData: {
    lines: Array<{
      tool: string;
      points: number[];
    }>;
    shapes?: Array<{
      type: 'rectangle' | 'circle' | 'text';
      x: number;
      y: number;
      width?: number;
      height?: number;
      radius?: number;
      text?: string;
    }>;
  };
  tags: string[];
}

export const templates: Template[] = [
  {
    id: 'login-form',
    name: 'Login Form',
    category: 'forms',
    description: 'Simple login form with email and password fields',
    preview: 'Email input, password input, submit button',
    canvasData: {
      shapes: [
        // Container
        { type: 'rectangle', x: 100, y: 100, width: 300, height: 250 },
        // Email input
        { type: 'rectangle', x: 120, y: 140, width: 260, height: 40 },
        { type: 'text', x: 130, y: 155, text: 'Email' },
        // Password input
        { type: 'rectangle', x: 120, y: 200, width: 260, height: 40 },
        { type: 'text', x: 130, y: 215, text: 'Password' },
        // Submit button
        { type: 'rectangle', x: 120, y: 270, width: 260, height: 45 },
        { type: 'text', x: 200, y: 290, text: 'Sign In' },
      ],
      lines: [],
    },
    tags: ['form', 'login', 'auth', 'input'],
  },
  {
    id:' signup-form',
    name: 'Signup Form',
    category: 'forms',
    description: 'Registration form with name, email, password',
    preview: 'Name, email, password inputs, signup button',
    canvasData: {
      shapes: [
        // Container
        { type: 'rectangle', x: 100, y: 80, width: 300, height: 320 },
        // Name input
        { type: 'rectangle', x: 120, y: 110, width: 260, height: 40 },
        { type: 'text', x: 130, y: 125, text: 'Full Name' },
        // Email input
        { type: 'rectangle', x: 120, y: 165, width: 260, height: 40 },
        { type: 'text', x: 130, y: 180, text: 'Email' },
        // Password input
        { type: 'rectangle', x: 120, y: 220, width: 260, height: 40 },
        { type: 'text', x: 130, y: 235, text: 'Password' },
        // Confirm Password
        { type: 'rectangle', x: 120, y: 275, width: 260, height: 40 },
        { type: 'text', x: 130, y: 290, text: 'Confirm Password' },
        // Submit button
        { type: 'rectangle', x: 120, y: 340, width: 260, height: 45 },
        { type: 'text', x: 190, y: 360, text: 'Create Account' },
      ],
      lines: [],
    },
    tags: ['form', 'signup', 'register', 'input'],
  },
  {
    id: 'navbar',
    name: 'Navigation Bar',
    category: 'navigation',
    description: 'Horizontal navbar with logo and menu items',
    preview: 'Logo, menu links, CTA button',
    canvasData: {
      shapes: [
        // Container
        { type: 'rectangle', x: 50, y: 50, width: 900, height: 70 },
        // Logo
        { type: 'text', x: 80, y: 85, text: 'LOGO' },
        // Nav items
        { type: 'text', x: 400, y: 85, text: 'Home' },
        { type: 'text', x: 480, y: 85, text: 'About' },
        { type: 'text', x: 560, y: 85, text: 'Services' },
        { type: 'text', x: 660, y: 85, text: 'Contact' },
        // CTA Button
        { type: 'rectangle', x: 820, y: 65, width: 100, height: 40 },
        { type: 'text', x: 845, y: 85, text: 'Sign Up' },
      ],
      lines: [],
    },
    tags: ['navigation', 'navbar', 'menu', 'header'],
  },
  {
    id: 'hero-section',
    name: 'Hero Section',
    category: 'hero',
    description: 'Landing page hero with heading, subheading, CTA',
    preview: 'Large heading, description, call-to-action button',
    canvasData: {
      shapes: [
        // Container
        { type: 'rectangle', x: 100, y: 100, width: 800, height: 400 },
        // Heading
        { type: 'text', x: 300, y: 200, text: 'Build Amazing UIs Fast' },
        // Subheading
        { type: 'text', x: 250, y: 250, text: 'Sketch to code in seconds with AI' },
        // CTA Buttons
        { type: 'rectangle', x: 300, y: 320, width: 150, height: 50 },
        { type: 'text', x: 340, y: 345, text: 'Get Started' },
        { type: 'rectangle', x: 470, y: 320, width: 150, height: 50 },
        { type: 'text', x: 510, y: 345, text: 'Learn More' },
      ],
      lines: [],
    },
    tags: ['hero', 'landing', 'header', 'cta'],
  },
  {
    id: 'card-3col',
    name: '3-Column Cards',
    category: 'cards',
    description: 'Three feature cards in a row',
    preview: 'Three cards with icon, title, description',
    canvasData: {
      shapes: [
        // Card 1
        { type: 'rectangle', x: 80, y: 100, width: 250, height: 200 },
        { type: 'circle', x: 205, y: 140, radius: 20 },
        { type: 'text', x: 150, y: 190, text: 'Feature One' },
        { type: 'text', x: 120, y: 220, text: 'Description here' },
        
        // Card 2
        { type: 'rectangle', x: 375, y: 100, width: 250, height: 200 },
        { type: 'circle', x: 500, y: 140, radius: 20 },
        { type: 'text', x: 445, y: 190, text: 'Feature Two' },
        { type: 'text', x: 415, y: 220, text: 'Description here' },
        
        // Card 3
        { type: 'rectangle', x: 670, y: 100, width: 250, height: 200 },
        { type: 'circle', x: 795, y: 140, radius: 20 },
        { type: 'text', x: 735, y: 190, text: 'Feature Three' },
        { type: 'text', x: 710, y: 220, text: 'Description here' },
      ],
      lines: [],
    },
    tags: ['cards', 'features', 'grid', 'layout'],
  },
  {
    id: 'pricing-table',
    name: 'Pricing Table',
    category: 'cards',
    description: 'Three-tier pricing cards',
    preview: 'Free, Pro, Enterprise plans',
    canvasData: {
      shapes: [
        // Free Plan
        { type: 'rectangle', x: 80, y: 80, width: 230, height: 300 },
        { type: 'text', x: 160, y: 120, text: 'Free' },
        { type: 'text', x: 165, y: 160, text: '$0/mo' },
        { type: 'rectangle', x: 110, y: 250, width: 170, height: 40 },
        { type: 'text', x: 150, y: 270, text: 'Get Started' },
        
        // Pro Plan
        { type: 'rectangle', x: 340, y: 60, width: 230, height: 320 },
        { type: 'text', x: 425, y: 110, text: 'Pro' },
        { type: 'text', x: 420, y: 150, text: '$29/mo' },
        { type: 'rectangle', x: 370, y: 250, width: 170, height: 40 },
        { type: 'text', x: 405, y: 270, text: 'Subscribe' },
        
        // Enterprise
        { type: 'rectangle', x: 600, y: 80, width: 230, height: 300 },
        { type: 'text', x: 665, y: 120, text: 'Enterprise' },
        { type: 'text', x: 675, y: 160, text: 'Custom' },
        { type: 'rectangle', x: 630, y: 250, width: 170, height: 40 },
        { type: 'text', x: 660, y: 270, text: 'Contact Us' },
      ],
      lines: [],
    },
    tags: ['pricing', 'plans', 'cards', 'subscription'],
  },
  {
    id: 'footer',
    name: 'Footer',
    category: 'layout',
    description: 'Website footer with links and social icons',
    preview: 'Links, social media icons, copyright',
    canvasData: {
      shapes: [
        // Container
        { type: 'rectangle', x: 50, y: 400, width: 900, height: 150 },
        // Links
        { type: 'text', x: 100, y: 450, text: 'About' },
        { type: 'text', x: 180, y: 450, text: 'Services' },
        { type: 'text', x: 270, y: 450, text: 'Contact' },
        { type: 'text', x: 360, y: 450, text: 'Privacy' },
        // Social Icons (circles)
        { type: 'circle', x: 750, y: 450, radius: 15 },
        { type: 'circle', x: 800, y: 450, radius: 15 },
        { type: 'circle', x: 850, y: 450, radius: 15 },
        // Copyright
        { type: 'text', x: 400, y: 520, text: '© 2026 Company Name' },
      ],
      lines: [],
    },
    tags: ['footer', 'links', 'social', 'layout'],
  },
  {
    id: 'contact-form',
    name: 'Contact Form',
    category: 'forms',
    description: 'Contact form with message textarea',
    preview: 'Name, email, message, submit button',
    canvasData: {
      shapes: [
        // Container
        { type: 'rectangle', x: 100, y: 80, width: 400, height: 380 },
        // Name
        { type: 'rectangle', x: 130, y: 120, width: 340, height: 40 },
        { type: 'text', x: 145, y: 135, text: 'Your Name' },
        // Email
        { type: 'rectangle', x: 130, y: 175, width: 340, height: 40 },
        { type: 'text', x: 145, y: 190, text: 'Email Address' },
        // Message
        { type: 'rectangle', x: 130, y: 230, width: 340, height: 120 },
        { type: 'text', x: 145, y: 250, text: 'Your Message' },
        // Submit
        { type: 'rectangle', x: 130, y: 380, width: 340, height: 50 },
        { type: 'text', x: 260, y: 405, text: 'Send Message' },
      ],
      lines: [],
    },
    tags: ['form', 'contact', 'message', 'input'],
  },
  {
    id: 'dashboard-sidebar',
    name: 'Dashboard Sidebar',
    category: 'navigation',
    description: 'Sidebar navigation for dashboard',
    preview: 'Logo, navigation menu items',
    canvasData: {
      shapes: [
        // Sidebar container
        { type: 'rectangle', x: 50, y: 50, width: 250, height: 500 },
        // Logo area
        { type: 'text', x: 120, y: 100, text: 'Dashboard' },
        // Menu items
        { type: 'rectangle', x: 70, y: 150, width: 210, height: 40 },
        { type: 'text', x: 100, y: 170, text: 'Home' },
        { type: 'rectangle', x: 70, y: 200, width: 210, height: 40 },
        { type: 'text', x: 100, y: 220, text: 'Projects' },
        { type: 'rectangle', x: 70, y: 250, width: 210, height: 40 },
        { type: 'text', x: 100, y: 270, text: 'Analytics' },
        { type: 'rectangle', x: 70, y: 300, width: 210, height: 40 },
        { type: 'text', x: 100, y: 320, text: 'Settings' },
      ],
      lines: [],
    },
    tags: ['sidebar', 'navigation', 'dashboard', 'menu'],
  },
  {
    id: 'profile-card',
    name: 'Profile Card',
    category: 'cards',
    description: 'User profile card component',
    preview: 'Avatar, name, bio, action button',
    canvasData: {
      shapes: [
        // Card container
        { type: 'rectangle', x: 150, y: 100, width: 300, height: 350 },
        // Avatar circle
        { type: 'circle', x: 300, y: 180, radius: 50 },
        // Name
        { type: 'text', x: 250, y: 260, text: 'John Doe' },
        // Bio
        { type: 'text', x: 220, y: 290, text: 'Product Designer' },
        // Stats bars
        { type: 'rectangle', x: 180, y: 330, width: 240, height: 30 },
        { type: 'text', x: 240, y: 345, text: '120 Projects' },
        // Action button
        { type: 'rectangle', x: 200, y: 390, width: 200, height: 40 },
        { type: 'text', x: 260, y: 410, text: 'View Profile' },
      ],
      lines: [],
    },
    tags: ['profile', 'card', 'user', 'avatar'],
  },
];

// Helper to get templates by category
export function getTemplatesByCategory(category: Template['category']): Template[] {
  return templates.filter((t) => t.category === category);
}

// Helper to search templates
export function searchTemplates(query: string): Template[] {
  const lowerQuery = query.toLowerCase();
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

export const TEMPLATE_CATEGORIES = [
  { id: 'forms', label: 'Forms', icon: '📝' },
  { id: 'navigation', label: 'Navigation', icon: '🧭' },
  { id: 'hero', label: 'Hero Sections', icon: '🎯' },
  { id: 'cards', label: 'Cards', icon: '🃏' },
  { id: 'layout', label: 'Layouts', icon: '📐' },
  { id: 'other', label: 'Other', icon: '✨' },
] as const;
