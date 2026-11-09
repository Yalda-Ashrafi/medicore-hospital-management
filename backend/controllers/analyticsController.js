const Appointment = require("../models/Appointment");
const Doctor = require("../models/Doctor");
const Patient = require("../models/Patient");
const Visit = require("../models/Visit");

function monthLabel(date) {
  return date.toLocaleString("en", { month: "short" });
}

async function monthlyRevenueFor(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const totals = await Visit.aggregate([
    { $match: { visitDate: { $gte: start, $lt: end } } },
    { $group: { _id: "$currency", totalMinor: { $sum: "$amountMinor" } } }
  ]);
  return {
    month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    totals: totals.reduce((result, item) => {
      result[item._id] = item.totalMinor;
      return result;
    }, { MYR: 0, USD: 0 })
  };
}

async function getDashboard(req, res) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const [totalPatients, totalDoctors, totalAppointments, activeAppointments, todaysAppointments, monthlyPatients, monthlyAppointments, doctorDistribution, monthlyRevenue] =
    await Promise.all([
      Patient.countDocuments(),
      Doctor.countDocuments(),
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: { $in: ["Pending", "Confirmed"] } }),
      Appointment.countDocuments({ appointmentDate: { $gte: dayStart, $lt: dayEnd } }),
      Patient.aggregate([
        { $match: { createdAt: { $gte: start } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $match: { appointmentDate: { $gte: start } } },
        { $group: { _id: { year: { $year: "$appointmentDate" }, month: { $month: "$appointmentDate" } }, count: { $sum: 1 } } }
      ]),
      Doctor.aggregate([
        { $group: { _id: "$specialization", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ]),
      req.user.role === "admin" ? monthlyRevenueFor(now) : Promise.resolve(null)
    ]);

  const months = Array.from({ length: 6 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 5 + index, 1));
  const countFor = (rows, date) => {
    const row = rows.find((item) => item._id.year === date.getFullYear() && item._id.month === date.getMonth() + 1);
    return row ? row.count : 0;
  };
  const data = {
    totalPatients,
    totalDoctors,
    totalAppointments,
    activeAppointments,
    todaysAppointments,
    availableBeds: 42,
    monthlyRevenue,
    months: months.map(monthLabel),
    patientGrowth: months.map((month) => countFor(monthlyPatients, month)),
    appointmentTrend: months.map((month) => countFor(monthlyAppointments, month)),
    doctorDistribution: doctorDistribution.map((item) => ({ name: item._id || "Other", count: item.count }))
  };
  if (req.user.role === "doctor") {
    delete data.availableBeds;
    delete data.monthlyRevenue;
  }
  res.json({
    success: true,
    data
  });
}

async function getMonthlyRevenue(req, res) {
  res.json({ success: true, data: await monthlyRevenueFor() });
}

async function getReports(req, res) {
  const [totalPatients, totalAppointments, mostBooked, monthly] = await Promise.all([
    Patient.countDocuments(),
    Appointment.countDocuments(),
    Appointment.aggregate([
      { $match: { status: { $ne: "Cancelled" } } },
      { $group: { _id: "$doctor", appointments: { $sum: 1 } } },
      { $sort: { appointments: -1 } },
      { $limit: 1 },
      { $lookup: { from: "doctors", localField: "_id", foreignField: "_id", as: "doctor" } },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, fullName: "$doctor.fullName", specialization: "$doctor.specialization", appointments: 1 } }
    ]),
    Appointment.aggregate([
      { $group: {
        _id: { year: { $year: "$appointmentDate" }, month: { $month: "$appointmentDate" } },
        total: { $sum: 1 },
        confirmed: { $sum: { $cond: [{ $eq: ["$status", "Confirmed"] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } }
      } },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 6 }
    ])
  ]);
  res.json({
    success: true,
    data: {
      totalPatients,
      totalAppointments,
      mostBookedDoctor: mostBooked[0] || null,
      monthlySummary: monthly.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
        total: item.total,
        confirmed: item.confirmed,
        cancelled: item.cancelled
      }))
    }
  });
}

module.exports = { getDashboard, getMonthlyRevenue, getReports, monthlyRevenueFor };
