/**
 * Deterministic fictional demo dataset for ClubHouse.
 *
 * - Every person is FICTIONAL. Names are invented; emails use the reserved
 *   demo domain demo.clubhouse.app which routes nowhere.
 * - Colleges are REAL Bengaluru institutions (listings only — no endorsement,
 *   partnership or official status is implied; see docs/DEMO_DATA.md).
 * - Seeded projects/clubs/events carry a "[Demo]" title prefix so demo
 *   content is never mistaken for official announcements.
 * - Pure data + deterministic builders (no IO) so tests can verify shape,
 *   counts and distributions without a database.
 */

export interface DemoCollege {
  name: string;
  location: string;
  description: string;
  website: string;
}

export interface DemoStudent {
  index: number; // 1..25
  clerkId: string; // placeholder until --with-clerk upgrades it
  name: string;
  email: string;
  age: number;
  course: string;
  semester: number;
  college: string; // college name
  pronouns: string;
  bio: string;
  interests: string[];
}

export interface DemoProject {
  title: string;
  description: string;
  techStack: string;
  status: "planning" | "active" | "completed";
  ownerIndex: number;
  college: string;
  openForApplications: boolean;
  requiredRoles: string[];
  memberIndexes: number[];
  /** [applicantIndex, status] */
  applications: Array<[number, "pending" | "accepted" | "rejected"]>;
}

export interface DemoClub {
  name: string;
  description: string;
  college: string;
  ownerIndex: number;
  memberNames: Array<[string, string]>; // [display name, role]
}

export interface DemoEvent {
  title: string;
  description: string;
  type: "hackathon" | "workshop" | "seminar" | "other";
  college: string | null; // null = platform-wide
  creatorIndex: number;
  startInDays: number; // relative to seed run (keeps dates upcoming)
  durationHours: number;
  maxParticipants: number | null;
  registrantIndexes: number[];
}

export interface DemoClubEvent {
  clubName: string;
  title: string;
  description: string;
  startInDays: number;
}

export const DEMO_COLLEGES: DemoCollege[] = [
  { name: "BMS College of Engineering", location: "Basavanagudi, Bengaluru", description: "Autonomous engineering college; demo listing only.", website: "https://bmsce.ac.in" },
  { name: "BNM Institute of Technology", location: "Banashankari, Bengaluru", description: "Engineering and technology institute; demo listing only.", website: "https://bnmit.org" },
  { name: "CMR Institute of Technology", location: "Kundalahalli, Bengaluru", description: "Engineering college near the IT corridor; demo listing only.", website: "https://cmrit.ac.in" },
  { name: "Cambridge Institute of Technology", location: "K R Puram, Bengaluru", description: "Engineering and management institute; demo listing only.", website: "https://cambridge.edu.in" },
  { name: "Dayananda Sagar College of Engineering", location: "Kumaraswamy Layout, Bengaluru", description: "Large multi-program campus; demo listing only.", website: "https://dsce.edu.in" },
  { name: "Don Bosco Institute of Technology", location: "Kumbalgodu, Bengaluru", description: "Engineering college on Mysuru Road; demo listing only.", website: "https://dbit.co.in" },
  { name: "Dr. Ambedkar Institute of Technology", location: "Mallathahalli, Bengaluru", description: "Aided engineering institute; demo listing only.", website: "https://drait.edu.in" },
  { name: "East Point College of Engineering and Technology", location: "Virgonagar, Bengaluru", description: "Engineering and technology college; demo listing only.", website: "https://eastpoint.ac.in" },
  { name: "City Engineering College", location: "Kanakapura Road, Bengaluru", description: "Engineering college; demo listing only.", website: "https://cityengineeringcollege.ac.in" },
  { name: "BGS College of Engineering and Technology", location: "Mahalakshmipuram, Bengaluru", description: "Engineering and technology college; demo listing only.", website: "https://bgscet.ac.in" },
  { name: "Brindavan College of Engineering", location: "Yelahanka, Bengaluru", description: "Engineering college; demo listing only.", website: "https://brindavancollege.com" },
  { name: "Bangalore Technological Institute", location: "Kodathi, Bengaluru", description: "Engineering and technology institute; demo listing only.", website: "https://bti.edu.in" },
  { name: "RV Institute of Technology and Management", location: "JP Nagar, Bengaluru", description: "Engineering and management institute; demo listing only.", website: "https://rvitm.edu.in" },
];

interface StudentSeed {
  name: string;
  course: string;
  semester: number;
  collegeIdx: number;
  pronouns: string;
  bio: string;
  interests: string[];
}

const STUDENT_SEEDS: StudentSeed[] = [
  { name: "Aarav Sharma", course: "B.Tech Computer Science", semester: 5, collegeIdx: 0, pronouns: "he/him", bio: "Full-stack tinkerer building campus tools with React and Node. Love hackathons and open source.", interests: ["Web Development", "Open Source", "DevOps"] },
  { name: "Diya Patel", course: "B.E. Information Science", semester: 3, collegeIdx: 0, pronouns: "she/her", bio: "Frontend developer exploring design systems and UI/UX. Figma first, code second.", interests: ["UI/UX", "Web Development"] },
  { name: "Arjun Reddy", course: "B.Tech AI & ML", semester: 6, collegeIdx: 4, pronouns: "he/him", bio: "ML student working on computer vision side projects. Kaggle nights and chai.", interests: ["AI/ML", "Python", "Data Science"] },
  { name: "Ananya Iyer", course: "B.E. Electronics & Communication", semester: 4, collegeIdx: 4, pronouns: "she/her", bio: "ECE student bridging hardware and software with IoT builds and sensor networks.", interests: ["IoT", "Embedded Systems", "Robotics"] },
  { name: "Vihaan Gupta", course: "B.Tech Computer Science", semester: 7, collegeIdx: 2, pronouns: "he/him", bio: "Backend engineer into distributed systems and cloud deployments. AWS free-tier survivor.", interests: ["Cloud", "DevOps", "Web Development"] },
  { name: "Ishita Singh", course: "B.E. Computer Science", semester: 2, collegeIdx: 2, pronouns: "she/her", bio: "First-year coder learning Python and web basics. Looking for beginner-friendly projects.", interests: ["Web Development", "Python"] },
  { name: "Kabir Mehta", course: "B.Tech Data Science", semester: 5, collegeIdx: 12, pronouns: "he/him", bio: "Data nerd turning campus datasets into dashboards. Pandas, plots, and strong opinions on charts.", interests: ["Data Science", "Python", "AI/ML"] },
  { name: "Myra Nair", course: "B.Des Communication Design", semester: 4, collegeIdx: 12, pronouns: "she/her", bio: "Designer who codes enough to be dangerous. Design systems, motion, and accessible UI.", interests: ["UI/UX", "Web Development"] },
  { name: "Aditya Rao", course: "B.E. Information Science", semester: 6, collegeIdx: 1, pronouns: "he/him", bio: "Mobile developer shipping Flutter apps to the Play Store. Offline-first everything.", interests: ["Mobile Development", "Flutter", "UI/UX"] },
  { name: "Sneha Kulkarni", course: "B.Tech Cyber Security", semester: 5, collegeIdx: 1, pronouns: "she/her", bio: "Security enthusiast doing CTFs on weekends. Into secure coding and network basics.", interests: ["Cybersecurity", "Cloud", "Open Source"] },
  { name: "Rohan Joshi", course: "B.E. Mechanical", semester: 6, collegeIdx: 6, pronouns: "he/him", bio: "Mechanical engineer who fell in love with robotics and ROS. Builds bots that (usually) move.", interests: ["Robotics", "IoT", "Embedded Systems"] },
  { name: "Priya Desai", course: "B.Tech AI & DS", semester: 3, collegeIdx: 6, pronouns: "she/her", bio: "AI student exploring NLP and chatbots. Currently teaching a bot to understand canteen menus.", interests: ["AI/ML", "Python", "Data Science"] },
  { name: "Karthik Menon", course: "B.E. Computer Science", semester: 8, collegeIdx: 3, pronouns: "he/him", bio: "Final-year dev placed and relaxed. Mentoring juniors in DSA and system design basics.", interests: ["Web Development", "DevOps", "Open Source"] },
  { name: "Tanvi Bhat", course: "B.E. Information Science", semester: 4, collegeIdx: 3, pronouns: "she/her", bio: "Full-stack learner building MERN projects. Into hackathons and women's tech communities.", interests: ["Web Development", "UI/UX", "Entrepreneurship"] },
  { name: "Nikhil Agarwal", course: "B.Tech Computer Science", semester: 5, collegeIdx: 5, pronouns: "he/him", bio: "Blockchain-curious dev exploring smart contracts and dApps between classes.", interests: ["Blockchain", "Web Development", "Cybersecurity"] },
  { name: "Riya Chawla", course: "B.E. Electronics & Communication", semester: 2, collegeIdx: 5, pronouns: "she/her", bio: "Sophomore exploring AR filters and creative coding. p5.js enjoyer.", interests: ["AR/VR", "UI/UX", "Game Development"] },
  { name: "Varun Pillai", course: "B.Tech AI & ML", semester: 7, collegeIdx: 7, pronouns: "he/him", bio: "ML engineer focused on edge deployment. TensorFlow Lite on tiny boards.", interests: ["AI/ML", "IoT", "Embedded Systems"] },
  { name: "Shreya Verma", course: "B.E. Computer Science", semester: 6, collegeIdx: 7, pronouns: "she/her", bio: "Game dev hobbyist building 2D platformers in Godot. Pixel art appreciator.", interests: ["Game Development", "UI/UX", "Open Source"] },
  { name: "Manav Shah", course: "B.Tech Information Technology", semester: 4, collegeIdx: 8, pronouns: "he/him", bio: "Cloud-native learner deploying everything twice. Kubernetes student, Docker enjoyer.", interests: ["Cloud", "DevOps", "Cybersecurity"] },
  { name: "Pooja Hegde", course: "B.E. Computer Science", semester: 3, collegeIdx: 8, pronouns: "she/her", bio: "Curious sophomore rotating through web, mobile and data to find her thing.", interests: ["Web Development", "Mobile Development", "Data Science"] },
  { name: "Dev Malhotra", course: "B.Tech Computer Science", semester: 6, collegeIdx: 9, pronouns: "he/him", bio: "Competitive programmer transitioning to product engineering. React + Go.", interests: ["Web Development", "Open Source", "Cloud"] },
  { name: "Naina Kapoor", course: "B.E. Information Science", semester: 5, collegeIdx: 9, pronouns: "she/her", bio: "Product-minded engineer who writes docs people actually read. Into startups and UX research.", interests: ["Entrepreneurship", "UI/UX", "Web Development"] },
  { name: "Yash Thakur", course: "B.E. Electrical & Electronics", semester: 5, collegeIdx: 10, pronouns: "he/him", bio: "EEE student automating everything with ESP32s and Home Assistant.", interests: ["IoT", "Embedded Systems", "Robotics"] },
  { name: "Kavya Nambiar", course: "B.Tech Cyber Security", semester: 7, collegeIdx: 11, pronouns: "she/her", bio: "Security senior into threat modeling and secure SDLC. CTF organizer on campus.", interests: ["Cybersecurity", "Cloud", "Open Source"] },
  { name: "Farhan Khan", course: "B.E. Computer Science", semester: 4, collegeIdx: 10, pronouns: "he/him", bio: "Android developer and OSS contributor. Kotlin, Compose, and campus app ideas.", interests: ["Mobile Development", "Open Source", "UI/UX"] },
];

export function demoEmail(index: number): string {
  return `student${String(index).padStart(2, "0")}@demo.clubhouse.app`;
}

export function demoClerkId(index: number): string {
  return `demo_student_${String(index).padStart(2, "0")}`;
}

export function buildStudents(): DemoStudent[] {
  return STUDENT_SEEDS.map((s, i) => {
    const index = i + 1;
    return {
      index,
      clerkId: demoClerkId(index),
      name: s.name,
      email: demoEmail(index),
      age: 17 + Math.min(6, Math.floor(s.semester / 2) + 1),
      course: s.course,
      semester: s.semester,
      college: DEMO_COLLEGES[s.collegeIdx].name,
      pronouns: s.pronouns,
      bio: s.bio,
      interests: s.interests,
    };
  });
}

export function portfolioFor(student: DemoStudent): Array<{ title: string; url: string; description?: string }> {
  const slug = student.name.toLowerCase().replace(/[^a-z]+/g, "-");
  const [a, b] = student.interests;
  return [
    { title: `${a} Mini Project`, url: `https://github.com/demo-${slug}/${a.toLowerCase().replace(/[^a-z]+/g, "-")}-mini`, description: `A learning build exploring ${a}.` },
    { title: `${b} Playground`, url: `https://github.com/demo-${slug}/${b.toLowerCase().replace(/[^a-z]+/g, "-")}-playground`, description: `Experiments and notes on ${b}.` },
  ];
}

export function socialsFor(student: DemoStudent): Record<string, string> {
  const handle = `demo-${student.name.toLowerCase().replace(/[^a-z]+/g, "")}`;
  const out: Record<string, string> = { github: `https://github.com/${handle}` };
  if (student.index % 2 === 0) out.linkedin = `https://linkedin.com/in/${handle}`;
  return out;
}

export const DEMO_PROJECTS: DemoProject[] = [
  { title: "[Demo] Smart Campus Navigation", description: "Indoor-outdoor navigation for large campuses with classroom search and accessibility-friendly routes.", techStack: "React, Node.js, PostgreSQL, MapLibre", status: "active", ownerIndex: 1, college: "BMS College of Engineering", openForApplications: true, requiredRoles: ["Frontend Developer", "UI/UX Designer"], memberIndexes: [1, 2, 4], applications: [[7, "pending"], [10, "pending"], [14, "accepted"], [16, "rejected"]] },
  { title: "[Demo] AI Study Planner", description: "Generates adaptive weekly study plans from syllabi and tracks revision streaks.", techStack: "Python, FastAPI, React, scikit-learn", status: "active", ownerIndex: 3, college: "Dayananda Sagar College of Engineering", openForApplications: true, requiredRoles: ["ML Engineer", "Backend Developer"], memberIndexes: [3, 7, 12], applications: [[6, "pending"], [20, "pending"], [17, "accepted"]] },
  { title: "[Demo] College Event Management Platform", description: "One place to publish fests, sell passes and check in attendees with QR codes.", techStack: "Next.js, Supabase, Tailwind", status: "active", ownerIndex: 14, college: "Cambridge Institute of Technology", openForApplications: true, requiredRoles: ["Backend Developer", "UI/UX Designer"], memberIndexes: [14, 2, 22], applications: [[9, "pending"], [25, "rejected"]] },
  { title: "[Demo] Campus Lost & Found", description: "Photo-based lost-and-found board with claim verification for hostels and departments.", techStack: "Flutter, Firebase", status: "planning", ownerIndex: 9, college: "BNM Institute of Technology", openForApplications: true, requiredRoles: ["Flutter Developer", "UI/UX Designer"], memberIndexes: [9], applications: [[20, "pending"], [16, "pending"]] },
  { title: "[Demo] Student Skill Exchange", description: "Barter skills with peers: teach guitar, learn Figma. Credit-based matching.", techStack: "React, Express, MongoDB", status: "active", ownerIndex: 22, college: "BGS College of Engineering and Technology", openForApplications: false, requiredRoles: [], memberIndexes: [22, 8, 14], applications: [] },
  { title: "[Demo] Smart Attendance System", description: "Wi-Fi + face-verification attendance that respects privacy with on-device checks.", techStack: "Python, OpenCV, React", status: "planning", ownerIndex: 17, college: "East Point College of Engineering and Technology", openForApplications: true, requiredRoles: ["ML Engineer", "Embedded Developer"], memberIndexes: [17], applications: [[3, "pending"], [24, "pending"]] },
  { title: "[Demo] Waste Classification with Computer Vision", description: "Bin-mounted camera sorts dry/wet/e-waste and logs fills for housekeeping.", techStack: "Python, TensorFlow Lite, Raspberry Pi", status: "active", ownerIndex: 4, college: "Dayananda Sagar College of Engineering", openForApplications: false, requiredRoles: [], memberIndexes: [4, 11, 23], applications: [] },
  { title: "[Demo] IoT Smart Energy Monitor", description: "Per-room energy dashboards from ESP32 meters with anomaly alerts for labs.", techStack: "ESP32, MQTT, React, InfluxDB", status: "active", ownerIndex: 23, college: "Brindavan College of Engineering", openForApplications: true, requiredRoles: ["Embedded Developer", "Frontend Developer"], memberIndexes: [23, 4], applications: [[11, "accepted"], [19, "pending"]] },
  { title: "[Demo] College Bus Tracking", description: "Live bus locations with ETA predictions and driver check-ins.", techStack: "Flutter, Node.js, Redis", status: "completed", ownerIndex: 25, college: "Brindavan College of Engineering", openForApplications: false, requiredRoles: [], memberIndexes: [25, 9, 20], applications: [] },
  { title: "[Demo] Student Mental Wellness Hub", description: "Anonymous peer-support circles plus curated campus counselling resources.", techStack: "React, Express, PostgreSQL", status: "active", ownerIndex: 12, college: "Dr. Ambedkar Institute of Technology", openForApplications: true, requiredRoles: ["Frontend Developer", "Product/Research"], memberIndexes: [12, 8], applications: [[2, "pending"], [16, "accepted"]] },
  { title: "[Demo] Local Startup Finder", description: "Discover student startups, filter by hiring needs, and request warm intros.", techStack: "Next.js, Prisma, PostgreSQL", status: "planning", ownerIndex: 21, college: "BGS College of Engineering and Technology", openForApplications: true, requiredRoles: ["Backend Developer", "UI/UX Designer"], memberIndexes: [21], applications: [[22, "pending"]] },
  { title: "[Demo] AI Resume Feedback Tool", description: "ATS-style resume scoring with role-specific keyword suggestions for freshers.", techStack: "Python, FastAPI, React, spaCy", status: "completed", ownerIndex: 13, college: "Cambridge Institute of Technology", openForApplications: false, requiredRoles: [], memberIndexes: [13, 3, 6], applications: [] },
  { title: "[Demo] Campus Emergency Alert Platform", description: "One-tap SOS with location broadcast to wardens and nearby volunteers.", techStack: "React Native, Node.js, WebSockets", status: "planning", ownerIndex: 10, college: "BNM Institute of Technology", openForApplications: true, requiredRoles: ["Flutter Developer", "Backend Developer", "Cybersecurity"], memberIndexes: [10], applications: [[15, "pending"], [24, "pending"], [19, "rejected"]] },
  { title: "[Demo] Smart Canteen Queue System", description: "Token-based canteen queues with live counters and pre-ordering.", techStack: "React, Firebase", status: "active", ownerIndex: 20, college: "City Engineering College", openForApplications: false, requiredRoles: [], memberIndexes: [20, 25], applications: [] },
  { title: "[Demo] Bengaluru Traffic Insight Dashboard", description: "Commute-time analytics from open traffic feeds for student routes.", techStack: "Python, React, Deck.gl", status: "active", ownerIndex: 7, college: "RV Institute of Technology and Management", openForApplications: true, requiredRoles: ["Frontend Developer", "Data Engineer"], memberIndexes: [7, 21], applications: [[5, "accepted"], [6, "pending"]] },
  { title: "[Demo] Peer Tutoring Platform", description: "Match juniors with senior tutors by subject, slot and language.", techStack: "React, Express, PostgreSQL", status: "completed", ownerIndex: 2, college: "BMS College of Engineering", openForApplications: false, requiredRoles: [], memberIndexes: [2, 13, 1], applications: [] },
];

export const DEMO_CLUBS: DemoClub[] = [
  { name: "[Demo] Coding Club", description: "Weekly sprints, DSA ladders and internal hack nights for all levels.", college: "BMS College of Engineering", ownerIndex: 1, memberNames: [["Diya Patel", "Design Lead"], ["Karthik Menon", "Mentor"]] },
  { name: "[Demo] AI & Machine Learning Club", description: "Paper readings, Kaggle squads and model deployment workshops.", college: "Dayananda Sagar College of Engineering", ownerIndex: 3, memberNames: [["Priya Desai", "Research Lead"], ["Kabir Mehta", "Data Lead"]] },
  { name: "[Demo] Robotics Club", description: "ROV, line-followers and ROS nights. Soldering irons provided.", college: "Dr. Ambedkar Institute of Technology", ownerIndex: 11, memberNames: [["Yash Thakur", "Hardware Lead"], ["Ananya Iyer", "IoT Lead"]] },
  { name: "[Demo] Web Development Club", description: "From first HTML page to deployed full-stack apps in a semester.", college: "CMR Institute of Technology", ownerIndex: 5, memberNames: [["Tanvi Bhat", "Frontend Lead"], ["Dev Malhotra", "Backend Lead"]] },
  { name: "[Demo] App Development Club", description: "Flutter and native app builds shipped to real users.", college: "BNM Institute of Technology", ownerIndex: 9, memberNames: [["Farhan Khan", "Android Lead"], ["Pooja Hegde", "Member"]] },
  { name: "[Demo] Cybersecurity Club", description: "CTFs, secure-coding dojos and campus awareness drives.", college: "Bangalore Technological Institute", ownerIndex: 24, memberNames: [["Sneha Kulkarni", "CTF Captain"], ["Manav Shah", "Cloud Lead"]] },
  { name: "[Demo] Open Source Club", description: "First-PR programs, maintainer talks and Hacktoberfest squads.", college: "RV Institute of Technology and Management", ownerIndex: 13, memberNames: [["Aarav Sharma", "Maintainer"], ["Shreya Verma", "Docs Lead"]] },
  { name: "[Demo] UI/UX Design Club", description: "Critique sessions, design systems and portfolio reviews.", college: "RV Institute of Technology and Management", ownerIndex: 8, memberNames: [["Myra Nair", "Member"], ["Riya Chawla", "Member"]] },
  { name: "[Demo] Entrepreneurship Club", description: "Idea jams, founder AMAs and demo days with student startups.", college: "BGS College of Engineering and Technology", ownerIndex: 22, memberNames: [["Naina Kapoor", "Member"], ["Tanvi Bhat", "Member"]] },
  { name: "[Demo] Game Development Club", description: "Game jams, Godot workshops and playtest Fridays.", college: "East Point College of Engineering and Technology", ownerIndex: 18, memberNames: [["Shreya Verma", "Member"], ["Riya Chawla", "Art Lead"]] },
  { name: "[Demo] IoT & Embedded Systems Club", description: "Sensor networks, PCB basics and campus automation pilots.", college: "Brindavan College of Engineering", ownerIndex: 4, memberNames: [["Varun Pillai", "Firmware Lead"]] },
  { name: "[Demo] Women in Technology Club", description: "Mentorship circles, speaker sessions and inclusive hack teams.", college: "Cambridge Institute of Technology", ownerIndex: 14, memberNames: [["Diya Patel", "Member"], ["Pooja Hegde", "Member"]] },
];

export const DEMO_EVENTS: DemoEvent[] = [
  { title: "[Demo] Bengaluru Smart Campus Hack", description: "48-hour hackathon: build tools that make campuses smarter, safer and greener.", type: "hackathon", college: null, creatorIndex: 1, startInDays: 12, durationHours: 48, maxParticipants: 200, registrantIndexes: [2, 3, 5, 9, 14, 20] },
  { title: "[Demo] AI for Student Life Challenge", description: "Build AI assistants for studying, scheduling and campus life.", type: "hackathon", college: "Dayananda Sagar College of Engineering", creatorIndex: 3, startInDays: 20, durationHours: 36, maxParticipants: 120, registrantIndexes: [7, 12, 17] },
  { title: "[Demo] Build for Bengaluru", description: "Civic-tech hackathon with traffic, waste and transit problem statements.", type: "hackathon", college: null, creatorIndex: 7, startInDays: 30, durationHours: 48, maxParticipants: 150, registrantIndexes: [1, 5, 21] },
  { title: "[Demo] GreenTech Student Hack", description: "Sustainability-themed builds: energy, water and waste on campus.", type: "hackathon", college: null, creatorIndex: 11, startInDays: 45, durationHours: 24, maxParticipants: 100, registrantIndexes: [4, 23] },
  { title: "[Demo] FinTech Innovation Sprint", description: "One-day sprint on student budgeting and campus payments.", type: "hackathon", college: null, creatorIndex: 15, startInDays: 18, durationHours: 12, maxParticipants: 80, registrantIndexes: [21, 22] },
  { title: "[Demo] Future Mobility Hack", description: "Prototype last-mile and shuttle ideas for Bengaluru commutes.", type: "hackathon", college: null, creatorIndex: 25, startInDays: 60, durationHours: 36, maxParticipants: 120, registrantIndexes: [9, 20] },
  { title: "[Demo] Git & GitHub Workshop", description: "Hands-on: branches, PRs and your first open-source contribution.", type: "workshop", college: null, creatorIndex: 13, startInDays: 5, durationHours: 3, maxParticipants: 60, registrantIndexes: [6, 16, 20, 25] },
  { title: "[Demo] React Development Workshop", description: "Components, hooks and data fetching by building a campus board.", type: "workshop", college: "BMS College of Engineering", creatorIndex: 1, startInDays: 8, durationHours: 4, maxParticipants: 50, registrantIndexes: [2, 14, 20] },
  { title: "[Demo] Flutter App Development Workshop", description: "Build and publish a notes app in one afternoon.", type: "workshop", college: "BNM Institute of Technology", creatorIndex: 9, startInDays: 10, durationHours: 4, maxParticipants: 40, registrantIndexes: [20, 25, 16] },
  { title: "[Demo] Introduction to AI/ML Workshop", description: "Zero-to-first-model session with scikit-learn on real datasets.", type: "workshop", college: null, creatorIndex: 17, startInDays: 14, durationHours: 3, maxParticipants: 70, registrantIndexes: [3, 6, 12] },
  { title: "[Demo] Python for Data Science Workshop", description: "Pandas, plots and a mini dashboard from campus data.", type: "workshop", college: null, creatorIndex: 7, startInDays: 16, durationHours: 3, maxParticipants: 60, registrantIndexes: [6, 20, 2] },
  { title: "[Demo] Cybersecurity Basics Workshop", description: "Threats, passwords, phishing drills and a beginner CTF.", type: "workshop", college: "Bangalore Technological Institute", creatorIndex: 24, startInDays: 22, durationHours: 4, maxParticipants: 50, registrantIndexes: [10, 19, 15] },
  { title: "[Demo] Cloud Deployment Workshop", description: "Ship a full-stack app to the cloud with CI in one session.", type: "workshop", college: null, creatorIndex: 5, startInDays: 26, durationHours: 3, maxParticipants: 45, registrantIndexes: [1, 13, 19] },
  { title: "[Demo] UI/UX for Developers Workshop", description: "Spacing, type and color for engineers who want prettier apps.", type: "workshop", college: null, creatorIndex: 8, startInDays: 28, durationHours: 3, maxParticipants: 55, registrantIndexes: [2, 14, 18] },
  { title: "[Demo] AI Engineering Careers", description: "Demo talk by fictional ML engineer Meera Krishnan on breaking into AI roles.", type: "seminar", college: null, creatorIndex: 3, startInDays: 9, durationHours: 2, maxParticipants: 150, registrantIndexes: [7, 12, 6, 17] },
  { title: "[Demo] How Student Startups Are Built", description: "Demo talk by fictional founder Arvind Rao on idea to first users.", type: "seminar", college: null, creatorIndex: 22, startInDays: 15, durationHours: 2, maxParticipants: 120, registrantIndexes: [14, 21, 2] },
  { title: "[Demo] Open Source Careers", description: "Demo talk by fictional maintainer Divya Nair on getting paid to maintain OSS.", type: "seminar", college: null, creatorIndex: 13, startInDays: 24, durationHours: 2, maxParticipants: 100, registrantIndexes: [1, 25, 18] },
  { title: "[Demo] Cybersecurity in 2026", description: "Demo talk by fictional analyst Rohit Shetty on the modern threat landscape.", type: "seminar", college: null, creatorIndex: 10, startInDays: 33, durationHours: 2, maxParticipants: 130, registrantIndexes: [15, 24, 19] },
  { title: "[Demo] Building with Cloud Platforms", description: "Demo talk by fictional cloud architect Sana Sheikh on shipping student projects.", type: "seminar", college: null, creatorIndex: 5, startInDays: 40, durationHours: 2, maxParticipants: 110, registrantIndexes: [1, 13, 19] },
  { title: "[Demo] Modern Full Stack Development", description: "Demo talk by fictional engineer Vikram Menon on React, APIs and Postgres.", type: "seminar", college: null, creatorIndex: 21, startInDays: 50, durationHours: 2, maxParticipants: 140, registrantIndexes: [2, 20, 14] },
];

export const DEMO_CLUB_EVENTS: DemoClubEvent[] = [
  { clubName: "[Demo] Coding Club", title: "Weekly Coding Sprint", description: "Timed DSA sprint followed by editorial walkthrough.", startInDays: 3 },
  { clubName: "[Demo] AI & Machine Learning Club", title: "AI Paper Discussion", description: "This week: attention is all you need, revisited.", startInDays: 6 },
  { clubName: "[Demo] Robotics Club", title: "Robotics Build Day", description: "Assemble and test the new line-follower chassis.", startInDays: 7 },
  { clubName: "[Demo] Web Development Club", title: "Hack Night", description: "Overnight build session with demos at sunrise.", startInDays: 11 },
  { clubName: "[Demo] Cybersecurity Club", title: "Cybersecurity Lab", description: "Beginner CTF: web exploitation basics.", startInDays: 13 },
  { clubName: "[Demo] Open Source Club", title: "Open Source Saturday", description: "Pair up and land your first PR.", startInDays: 9 },
  { clubName: "[Demo] UI/UX Design Club", title: "UI/UX Critique Session", description: "Bring a screen, leave with feedback.", startInDays: 4 },
  { clubName: "[Demo] Game Development Club", title: "Mini Game Jam", description: "48 hours, one theme, many platformers.", startInDays: 21 },
  { clubName: "[Demo] IoT & Embedded Systems Club", title: "Sensor Workshop", description: "Wire up DHT22s and stream to a dashboard.", startInDays: 17 },
  { clubName: "[Demo] Entrepreneurship Club", title: "Idea Jam", description: "Pitch raw ideas, form teams on the spot.", startInDays: 19 },
  { clubName: "[Demo] App Development Club", title: "App Teardown Night", description: "Dissect great apps screen by screen.", startInDays: 25 },
  { clubName: "[Demo] Women in Technology Club", title: "Mentorship Circle", description: "Small-group mentoring with senior students.", startInDays: 29 },
];
