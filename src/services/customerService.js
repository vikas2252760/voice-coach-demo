// Realistic customer data service with dynamic values

const customerProfiles = [
  {
    id: 1,
    name: "Christina Greenberg",
    familySize: 6,
    children: "young kids (6mo-5yrs)",
    lifestyle: "busy lifestyle",
    techUsage: "uses smart home tech and laptop",
    deviceRisk: 75,
    income: "middle-high",
    location: "suburban"
  },
  {
    id: 2,
    name: "Michael Rodriguez",
    familySize: 4,
    children: "teenagers (13-17yrs)",
    lifestyle: "tech-savvy family",
    techUsage: "multiple gaming consoles, tablets, laptops",
    deviceRisk: 82,
    income: "high",
    location: "urban"
  },
  {
    id: 3,
    name: "Sarah Johnson",
    familySize: 3,
    children: "elementary age (8-12yrs)",
    lifestyle: "working parent",
    techUsage: "work from home setup, smart TV, tablets",
    deviceRisk: 68,
    income: "middle",
    location: "suburban"
  },
  {
    id: 4,
    name: "David Chen",
    familySize: 2,
    children: "no children",
    lifestyle: "young professionals",
    techUsage: "high-end devices, smart home automation",
    deviceRisk: 71,
    income: "high",
    location: "urban"
  }
];

const serviceTypes = [
  "Delivery and setup",
  "Installation and activation",
  "Tech support visit",
  "Device upgrade",
  "Network optimization"
];

// Generate realistic appointment times
const generateAppointmentTime = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  
  // Random hour between 9 AM and 5 PM
  const hour = Math.floor(Math.random() * 8) + 9;
  const minutes = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
  
  tomorrow.setHours(hour, minutes, 0, 0);
  
  const startTime = tomorrow.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  const endTime = new Date(tomorrow.getTime() + 30 * 60000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  return `${startTime}-${endTime}`;
};

// Generate dynamic protection score based on customer profile
const calculateProtectionScore = (customer) => {
  let baseScore = customer.deviceRisk;
  
  // Add some randomness to make it feel live
  const variance = Math.floor(Math.random() * 10) - 5; // ±5 points
  baseScore += variance;
  
  // Ensure score is within reasonable bounds
  return Math.max(60, Math.min(95, baseScore));
};

// Generate personalized pitch points
const generatePitchPoints = (customer) => {
  const pitchVariations = {
    families: [
      `As your ${customer.children} grow, VHDP auto-covers new eligible tablets or smart speakers — no need to add them later`,
      `With ${customer.familySize} family members, accidents happen. VHDP covers accidental damage on all your devices`,
      `Protect your family's digital life — from work laptops to kids' tablets, all under one plan`
    ],
    professionals: [
      `Your work-from-home setup deserves premium protection — VHDP covers your laptops and tablets for business continuity`,
      `As a busy professional, you can't afford device downtime. VHDP offers same-day replacement options`,
      `Protect your investment in high-end devices with comprehensive coverage including liquid damage`
    ],
    techSavvy: [
      `With your extensive tech collection, managing separate warranties is complex — VHDP simplifies everything`,
      `Your smart home devices and gaming equipment need specialized protection that standard warranties don't cover`,
      `As an early adopter, protect new device purchases automatically with VHDP's future-device coverage`
    ]
  };
  
  let category = 'families';
  if (customer.familySize <= 2 && customer.children === 'no children') {
    category = 'professionals';
  } else if (String(customer.techUsage || '').toLowerCase().includes('gaming') || String(customer.techUsage || '').toLowerCase().includes('smart home')) {
    category = 'techSavvy';
  }
  
  return pitchVariations[category];
};

// Generate personalized guidance
const generateGuidance = (customer) => {
  const guidanceMap = {
    families: "Empathize with busy family life. Focus on simplicity and future-proofing their growing tech needs.",
    professionals: "Highlight business continuity and productivity. Emphasize time-saving and reliability aspects.",
    techSavvy: "Appeal to their technical knowledge. Discuss comprehensive coverage and advanced features."
  };
  
  let category = 'families';
  if (customer.familySize <= 2 && customer.children === 'no children') {
    category = 'professionals';
  } else if (String(customer.techUsage || '').toLowerCase().includes('gaming') || String(customer.techUsage || '').toLowerCase().includes('smart home')) {
    category = 'techSavvy';
  }
  
  return guidanceMap[category];
};

// Current time for status bar
export const getCurrentTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  });
};

// Get current customer (simulate rotating customers throughout the day)
export const getCurrentCustomer = () => {
  const now = new Date();
  const customerIndex = Math.floor((now.getHours() + now.getMinutes() / 60) / 6) % customerProfiles.length;
  const customer = customerProfiles[customerIndex];
  
  return {
    ...customer,
    appointmentTime: generateAppointmentTime(),
    serviceType: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
    protectionScore: calculateProtectionScore(customer),
    pitchPoints: generatePitchPoints(customer),
    guidance: generateGuidance(customer),
    lastUpdated: now.toISOString()
  };
};

// Simulate real-time updates
export const subscribeToUpdates = (callback) => {
  const interval = setInterval(() => {
    callback(getCurrentCustomer());
  }, 30000); // Update every 30 seconds
  
  return () => clearInterval(interval);
};

// Job step status simulation
export const getJobStepStatus = () => {
  const now = new Date();
  const minute = now.getMinutes();
  
  // Simulate progression through job steps based on time
  const currentStep = Math.floor(minute / 15) % 4 + 1;
  
  return {
    currentStep,
    steps: [
      { id: 1, text: "Contact customer", completed: currentStep > 1, active: currentStep === 1 },
      { id: 2, text: "Arrival and delivery", completed: currentStep > 2, active: currentStep === 2 },
      { id: 3, text: "Phone activation", completed: currentStep > 3, active: currentStep === 3 },
      { id: 4, text: "Post-job survey", completed: currentStep > 4, active: currentStep === 4 }
    ]
  };
};

// Network signal simulation
export const getNetworkStatus = () => {
  const signalStrength = Math.floor(Math.random() * 4) + 1; // 1-4 bars
  const wifiConnected = Math.random() > 0.1; // 90% chance connected
  const batteryLevel = Math.floor(Math.random() * 40) + 60; // 60-100%
  
  return {
    signal: '●'.repeat(signalStrength) + '○'.repeat(4 - signalStrength),
    wifi: wifiConnected ? '📶' : '📵',
    battery: batteryLevel > 80 ? '🔋' : batteryLevel > 20 ? '🔋' : '🪫'
  };
};
