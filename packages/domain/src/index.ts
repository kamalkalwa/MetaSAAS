/**
 * @metasaas/domain
 *
 * Exports all domain entities, navigation, seed data, and event subscribers.
 * The API server imports this to register everything with the platform.
 */

import type { EntityDefinition, NavigationItem } from "@metasaas/contracts";
import { CompanyEntity } from "./entities/company/company.entity.js";
import { ContactEntity } from "./entities/contact/contact.entity.js";
import { ProjectEntity } from "./entities/project/project.entity.js";
import { TaskEntity } from "./entities/task/task.entity.js";
import { WarehouseEntity } from "./entities/warehouse/warehouse.entity.js";
import { ProductEntity } from "./entities/product/product.entity.js";
import { DoctorEntity } from "./entities/doctor/doctor.entity.js";
import { PatientEntity } from "./entities/patient/patient.entity.js";
import { AppointmentEntity } from "./entities/appointment/appointment.entity.js";
import { MemberEntity } from "./entities/member/member.entity.js";
import { TrainerEntity } from "./entities/trainer/trainer.entity.js";
import { ClassEntity } from "./entities/class/class.entity.js";
import { EnrollmentEntity } from "./entities/enrollment/enrollment.entity.js";
export { eventSubscribers } from "./subscribers/index.js";

/**
 * All entity definitions in this domain.
 * Order matters — entities with no dependencies should come first.
 * Parent entities must appear before children that reference them via FK.
 */
export const entities: EntityDefinition[] = [
  CompanyEntity,
  ContactEntity,
  ProjectEntity,
  TaskEntity,
  WarehouseEntity,
  ProductEntity,
  DoctorEntity,
  PatientEntity,
  AppointmentEntity,
  MemberEntity,
  TrainerEntity,
  ClassEntity,
  EnrollmentEntity,
];

/**
 * Sidebar navigation items.
 * Order determines display position in the sidebar.
 */
export const navigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "layout-dashboard", order: 0 },
  { label: "Contacts", href: "/contacts", icon: "users", order: 1 },
  { label: "Companies", href: "/companies", icon: "building", order: 2 },
  { label: "Projects", href: "/projects", icon: "folder-kanban", order: 3 },
  { label: "Tasks", href: "/tasks", icon: "check-square", order: 4 },
  { label: "Warehouses", href: "/warehouses", icon: "package", order: 5 },
  { label: "Products", href: "/products", icon: "package", order: 6 },
  { label: "Doctors", href: "/doctors", icon: "stethoscope", order: 7 },
  { label: "Patients", href: "/patients", icon: "user", order: 8 },
  { label: "Appointments", href: "/appointments", icon: "calendar-clock", order: 9 },
  { label: "Members", href: "/members", icon: "users", order: 99 },
  { label: "Trainers", href: "/trainers", icon: "user", order: 99 },
  { label: "Classes", href: "/classes", icon: "calendar", order: 99 },
  { label: "Enrollments", href: "/enrollments", icon: "listChecks", order: 99 },
];

/**
 * Seed data for development/demo purposes.
 * Order matters — parent entities (Company, Project) must be seeded before
 * child entities (Contact, Task) that reference them via foreign keys.
 *
 * NOTE: For entities with belongsTo relationships, foreign key values
 * (e.g., projectId) must be populated separately after seeding parents,
 * since UUIDs are generated at insert time. The seed script handles this
 * by inserting parents first, then linking children.
 */
export const seedData: Record<string, Record<string, unknown>[]> = {
  Company: [
    { name: "Acme Corporation", industry: "Technology", website: "https://acme.example.com", size: "51-200" },
    { name: "Globex Industries", industry: "Manufacturing", website: "https://globex.example.com", size: "201-1000" },
    { name: "Initech", industry: "Technology", website: "https://initech.example.com", size: "11-50" },
    { name: "Umbrella Corp", industry: "Healthcare", website: "https://umbrella.example.com", size: "1000+" },
    { name: "Stark Industries", industry: "Engineering", website: "https://stark.example.com", size: "1000+" },
  ],
  Contact: [
    { name: "Alice Johnson", email: "alice@acme.example.com", role: "CEO", status: "active", source: "referral" },
    { name: "Bob Smith", email: "bob@globex.example.com", role: "CTO", status: "active", source: "conference" },
    { name: "Carol Williams", email: "carol@initech.example.com", role: "VP Engineering", status: "lead", source: "website" },
    { name: "David Brown", email: "david@umbrella.example.com", role: "Product Manager", status: "active", source: "referral" },
    { name: "Eve Davis", email: "eve@stark.example.com", role: "Head of Sales", status: "lead", source: "cold_outreach" },
    { name: "Frank Miller", email: "frank@acme.example.com", role: "Engineering Manager", status: "active", source: "referral" },
    { name: "Grace Lee", email: "grace@globex.example.com", role: "Designer", status: "inactive", source: "website" },
    { name: "Henry Wilson", email: "henry@initech.example.com", role: "Developer", status: "lead", source: "conference" },
    { name: "Ivy Chen", email: "ivy@umbrella.example.com", role: "Data Scientist", status: "active", source: "website" },
    { name: "Jack Taylor", email: "jack@stark.example.com", role: "CFO", status: "active", source: "referral" },
  ],
  Project: [
    { name: "Website Redesign", description: "Complete overhaul of the company website with modern design.", status: "active", priority: "high", startDate: "2026-01-15T00:00:00Z", dueDate: "2026-04-30T00:00:00Z" },
    { name: "Mobile App v2", description: "Second major version of the mobile application.", status: "planning", priority: "critical", startDate: "2026-03-01T00:00:00Z", dueDate: "2026-09-30T00:00:00Z" },
    { name: "Data Migration", description: "Migrate legacy data from the old CRM system.", status: "completed", priority: "medium", startDate: "2025-11-01T00:00:00Z", dueDate: "2026-01-31T00:00:00Z" },
    { name: "API Gateway", description: "Implement a centralized API gateway for microservices.", status: "active", priority: "high", startDate: "2026-02-01T00:00:00Z", dueDate: "2026-06-30T00:00:00Z" },
    { name: "Security Audit", description: "Annual security audit and penetration testing.", status: "on_hold", priority: "low", startDate: "2026-05-01T00:00:00Z", dueDate: "2026-05-31T00:00:00Z" },
  ],
  Task: [
    { title: "Design homepage mockup", description: "Create Figma mockups for the new homepage.", status: "done", priority: "high", dueDate: "2026-02-01T00:00:00Z", estimatedHours: 8 },
    { title: "Implement responsive navbar", description: "Build a responsive navigation bar component.", status: "in_progress", priority: "high", dueDate: "2026-02-15T00:00:00Z", estimatedHours: 12 },
    { title: "Write API documentation", description: "Document all REST API endpoints.", status: "todo", priority: "medium", dueDate: "2026-03-01T00:00:00Z", estimatedHours: 16 },
    { title: "Setup CI/CD pipeline", description: "Configure GitHub Actions for automated builds and deployments.", status: "review", priority: "high", dueDate: "2026-02-10T00:00:00Z", estimatedHours: 6 },
    { title: "Database schema review", description: "Review and optimize database schema for performance.", status: "todo", priority: "medium", dueDate: "2026-03-15T00:00:00Z", estimatedHours: 4 },
    { title: "User authentication flow", description: "Implement login, signup, and password reset.", status: "todo", priority: "high", dueDate: "2026-02-28T00:00:00Z", estimatedHours: 20 },
    { title: "Load testing", description: "Run load tests against the API to find bottlenecks.", status: "todo", priority: "low", dueDate: "2026-04-15T00:00:00Z", estimatedHours: 10 },
    { title: "Migrate user data", description: "Move user records from legacy system.", status: "done", priority: "high", dueDate: "2026-01-15T00:00:00Z", estimatedHours: 24 },
  ],
  Warehouse: [
    { name: "East Coast Hub", address: "123 Industrial Blvd, Newark, NJ 07102", status: "active", capacitySqm: 5000, managerEmail: "manager.east@example.com" },
    { name: "West Coast DC", address: "456 Commerce Dr, Los Angeles, CA 90001", status: "active", capacitySqm: 8000, managerEmail: "manager.west@example.com" },
    { name: "Central Storage", address: "789 Warehouse Rd, Dallas, TX 75201", status: "maintenance", capacitySqm: 3500 },
  ],
  Product: [
    { name: "Wireless Keyboard", sku: "KB-001", category: "electronics", status: "active", price: 79.99, quantity: 250, reorderLevel: 50 },
    { name: "Ergonomic Chair", sku: "CH-001", category: "furniture", status: "active", price: 499.00, quantity: 30, reorderLevel: 10 },
    { name: "USB-C Hub", sku: "HB-001", category: "electronics", status: "active", price: 45.00, quantity: 500, reorderLevel: 100 },
    { name: "Standing Desk", sku: "DK-001", category: "furniture", status: "draft", price: 899.00, quantity: 0 },
    { name: "Noise-Canceling Headphones", sku: "HP-001", category: "electronics", status: "active", price: 299.00, quantity: 120, reorderLevel: 25 },
    { name: "Vintage Monitor (Discontinued)", sku: "MN-099", category: "electronics", status: "discontinued", price: 199.00, quantity: 5 },
  ],
  Doctor: [
    { name: "Dr. Sarah Chen", specialty: "general_practice", email: "sarah.chen@clinic.example.com", phone: "+1-555-0101", status: "available" },
    { name: "Dr. James Patel", specialty: "cardiology", email: "james.patel@clinic.example.com", phone: "+1-555-0102", status: "available" },
    { name: "Dr. Maria Rodriguez", specialty: "pediatrics", email: "maria.rodriguez@clinic.example.com", phone: "+1-555-0103", status: "available" },
    { name: "Dr. Robert Kim", specialty: "orthopedics", email: "robert.kim@clinic.example.com", phone: "+1-555-0104", status: "on_leave" },
  ],
  Patient: [
    { name: "Emily Watson", email: "emily.watson@example.com", phone: "+1-555-1001", dateOfBirth: "1988-03-15T00:00:00Z", status: "active" },
    { name: "Michael Torres", email: "michael.torres@example.com", phone: "+1-555-1002", dateOfBirth: "1975-07-22T00:00:00Z", status: "active" },
    { name: "Lisa Chang", email: "lisa.chang@example.com", phone: "+1-555-1003", dateOfBirth: "1995-11-08T00:00:00Z", status: "active" },
    { name: "David Okafor", email: "david.okafor@example.com", phone: "+1-555-1004", status: "active" },
    { name: "Anna Petrov", email: "anna.petrov@example.com", phone: "+1-555-1005", dateOfBirth: "1960-01-30T00:00:00Z", status: "inactive" },
  ],
  Appointment: [
    { title: "Annual checkup", dateTime: "2026-02-20T09:00:00Z", type: "routine_checkup", status: "confirmed", durationMinutes: 30 },
    { title: "Chest pain follow-up", dateTime: "2026-02-21T14:00:00Z", type: "follow_up", status: "scheduled", durationMinutes: 45 },
    { title: "Child vaccination", dateTime: "2026-02-22T10:30:00Z", type: "consultation", status: "scheduled", durationMinutes: 20 },
    { title: "Knee pain assessment", dateTime: "2026-02-18T11:00:00Z", type: "consultation", status: "completed", durationMinutes: 60, notes: "Referred for MRI scan." },
    { title: "Blood pressure review", dateTime: "2026-02-19T15:30:00Z", type: "follow_up", status: "no_show", durationMinutes: 15 },
  ],
  Member: [
    { firstName: "Alex", lastName: "Rivera", email: "alex.r@example.com", phone: "+1-555-2001", membershipType: "Premium", status: "Active", joinDate: "2025-06-15T00:00:00Z" },
    { firstName: "Sam", lastName: "Nguyen", email: "sam.n@example.com", phone: "+1-555-2002", membershipType: "Basic", status: "Active", joinDate: "2025-09-01T00:00:00Z" },
    { firstName: "Jordan", lastName: "Blake", email: "jordan.b@example.com", membershipType: "VIP", status: "Active", joinDate: "2024-12-01T00:00:00Z" },
    { firstName: "Taylor", lastName: "Frost", email: "taylor.f@example.com", membershipType: "Basic", status: "Suspended", joinDate: "2025-03-10T00:00:00Z" },
  ],
  Trainer: [
    { firstName: "Marcus", lastName: "Steele", email: "marcus.s@gym.example.com", phone: "+1-555-3001", specialization: "Strength & Conditioning" },
    { firstName: "Leah", lastName: "Kim", email: "leah.k@gym.example.com", phone: "+1-555-3002", specialization: "Yoga & Flexibility" },
    { firstName: "Derek", lastName: "Hall", email: "derek.h@gym.example.com", specialization: "HIIT & Cardio" },
  ],
  Class: [
    { name: "Morning Yoga", description: "Relaxing yoga session to start your day.", startTime: "2026-02-20T07:00:00Z", duration: 60, capacity: 20 },
    { name: "HIIT Blast", description: "High-intensity interval training for all levels.", startTime: "2026-02-20T12:00:00Z", duration: 45, capacity: 15 },
    { name: "Strength Foundations", description: "Barbell and dumbbell fundamentals.", startTime: "2026-02-21T09:00:00Z", duration: 75, capacity: 12 },
  ],
  Enrollment: [
    { enrollmentDate: "2026-02-15T10:00:00Z" },
    { enrollmentDate: "2026-02-16T14:30:00Z" },
    { enrollmentDate: "2026-02-17T09:00:00Z" },
  ],
};
