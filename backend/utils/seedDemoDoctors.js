const Doctor = require("../models/Doctor");

const demoDoctors = [
  {
    fullName: "Aisha Rahman",
    specialization: "Cardiology",
    roomNumber: "101",
    healthConcerns: ["heart health", "high blood pressure", "chest pain"],
    phone: "+60 3-5550-0101",
    email: "aisha.rahman@medicore.example.test",
    availability: "Mon-Fri, 9:00 AM-4:00 PM"
  },
  {
    fullName: "Daniel Wong",
    specialization: "Dermatology",
    roomNumber: "102",
    healthConcerns: ["acne", "eczema", "rashes", "skin allergies"],
    phone: "+60 3-5550-0102",
    email: "daniel.wong@medicore.example.test",
    availability: "Mon-Thu, 10:00 AM-5:00 PM"
  },
  {
    fullName: "Priya Nair",
    specialization: "Pediatrics",
    roomNumber: "103",
    healthConcerns: ["childhood illness", "fever", "infant care", "vaccinations"],
    phone: "+60 3-5550-0103",
    email: "priya.nair@medicore.example.test",
    availability: "Mon-Fri, 8:30 AM-3:30 PM"
  },
  {
    fullName: "Lim Wei Jian",
    specialization: "Orthopedics",
    roomNumber: "104",
    healthConcerns: ["back pain", "joint pain", "fractures", "sports injuries"],
    phone: "+60 3-5550-0104",
    email: "wei.jian.lim@medicore.example.test",
    availability: "Tue-Sat, 9:00 AM-4:00 PM"
  },
  {
    fullName: "Nurul Huda",
    specialization: "Neurology",
    roomNumber: "105",
    healthConcerns: ["headaches", "migraine", "seizures", "nerve concerns"],
    phone: "+60 3-5550-0105",
    email: "nurul.huda@medicore.example.test",
    availability: "Mon-Thu, 9:00 AM-4:30 PM"
  },
  {
    fullName: "Jonathan Lee",
    specialization: "ENT",
    roomNumber: "106",
    healthConcerns: ["ear infections", "sinus concerns", "sore throat", "hearing"],
    phone: "+60 3-5550-0106",
    email: "jonathan.lee@medicore.example.test",
    availability: "Mon-Fri, 10:00 AM-5:00 PM"
  },
  {
    fullName: "Farah Ismail",
    specialization: "Obstetrics and Gynecology",
    roomNumber: "107",
    healthConcerns: ["pregnancy care", "menstrual concerns", "women's health"],
    phone: "+60 3-5550-0107",
    email: "farah.ismail@medicore.example.test",
    availability: "Mon-Fri, 9:00 AM-4:00 PM"
  },
  {
    fullName: "Arjun Kumar",
    specialization: "Gastroenterology",
    roomNumber: "108",
    healthConcerns: ["stomach pain", "acid reflux", "digestive concerns", "liver health"],
    phone: "+60 3-5550-0108",
    email: "arjun.kumar@medicore.example.test",
    availability: "Mon-Thu, 9:30 AM-4:30 PM"
  },
  {
    fullName: "Mei Tan",
    specialization: "Ophthalmology",
    roomNumber: "109",
    healthConcerns: ["eye infections", "vision concerns", "eye strain"],
    phone: "+60 3-5550-0109",
    email: "mei.tan@medicore.example.test",
    availability: "Mon-Fri, 8:30 AM-3:30 PM"
  },
  {
    fullName: "Samuel Joseph",
    specialization: "Endocrinology",
    roomNumber: "110",
    healthConcerns: ["diabetes", "thyroid concerns", "hormone health"],
    phone: "+60 3-5550-0110",
    email: "samuel.joseph@medicore.example.test",
    availability: "Tue-Sat, 9:00 AM-4:00 PM"
  },
  {
    fullName: "Kavitha Devi",
    specialization: "Pulmonology",
    roomNumber: "111",
    healthConcerns: ["asthma", "persistent cough", "breathing concerns"],
    phone: "+60 3-5550-0111",
    email: "kavitha.devi@medicore.example.test",
    availability: "Mon-Fri, 9:00 AM-4:00 PM"
  },
  {
    fullName: "Hafiz Ahmad",
    specialization: "Urology",
    roomNumber: "112",
    healthConcerns: ["urinary concerns", "kidney stones", "bladder health"],
    phone: "+60 3-5550-0112",
    email: "hafiz.ahmad@medicore.example.test",
    availability: "Mon-Thu, 10:00 AM-5:00 PM"
  },
  {
    fullName: "Sarah Lim",
    specialization: "Psychiatry",
    roomNumber: "113",
    healthConcerns: ["anxiety", "low mood", "sleep concerns", "stress"],
    phone: "+60 3-5550-0113",
    email: "sarah.lim@medicore.example.test",
    availability: "Mon-Fri, 9:00 AM-4:00 PM"
  },
  {
    fullName: "Benjamin Chua",
    specialization: "General Practice",
    roomNumber: "114",
    healthConcerns: ["fever", "cold and flu", "general checkups", "common illness"],
    phone: "+60 3-5550-0114",
    email: "benjamin.chua@medicore.example.test",
    availability: "Mon-Sat, 8:00 AM-5:00 PM"
  },
  {
    fullName: "Dr. Farhad Wardak",
    specialization: "Ophthalmology",
    roomNumber: "115",
    healthConcerns: ["eye concerns", "vision problems", "eye infections"],
    phone: "+60 3-5550-0115",
    email: "farhad.wardak@medicore.example.test",
    availability: "Contact reception for appointment availability"
  },
  {
    fullName: "Dr. Freshta Rahimi",
    specialization: "Cardiology",
    roomNumber: "116",
    healthConcerns: ["heart health", "chest pain", "heart concerns"],
    phone: "+60 3-5550-0116",
    email: "freshta.rahimi@medicore.example.test",
    availability: "Contact reception for appointment availability"
  },
  {
    fullName: "Dr. Jawed Noori",
    specialization: "Nephrology",
    roomNumber: "117",
    healthConcerns: ["kidney health", "kidney stones", "kidney concerns"],
    phone: "+60 3-5550-0117",
    email: "jawed.noori@medicore.example.test",
    availability: "Contact reception for appointment availability"
  },
  {
    fullName: "Dr. Setayesh Karimi",
    specialization: "Gastroenterology",
    roomNumber: "118",
    healthConcerns: ["stomach concerns", "digestive health", "liver health"],
    phone: "+60 3-5550-0118",
    email: "setayesh.karimi@medicore.example.test",
    availability: "Contact reception for appointment availability"
  },
  {
    fullName: "Dr. Ehsanullah Ahmadi",
    specialization: "Pulmonology",
    roomNumber: "119",
    healthConcerns: ["lung health", "breathing concerns", "respiratory conditions"],
    phone: "+60 3-5550-0119",
    email: "ehsanullah.ahmadi@medicore.example.test",
    availability: "Contact reception for appointment availability"
  },
  {
    fullName: "Dr. Naeem",
    specialization: "Radiology",
    roomNumber: "120",
    healthConcerns: ["X-ray imaging", "medical imaging", "radiology"],
    phone: "+60 3-5550-0120",
    email: "naeem.radiology@medicore.example.test",
    availability: "Contact reception for appointment availability"
  }
];

async function seedDemoDoctors() {
  const results = await Promise.all(demoDoctors.map((doctor) => Doctor.updateOne(
    { email: doctor.email },
    { $setOnInsert: doctor },
    { upsert: true }
  )));
  await Promise.all(demoDoctors.map((doctor) => Doctor.updateOne(
    { email: doctor.email, roomNumber: { $exists: false } },
    { $set: { roomNumber: doctor.roomNumber } }
  )));
  return results.reduce((count, result) => count + result.upsertedCount, 0);
}

module.exports = { demoDoctors, seedDemoDoctors };
