import React, { useState } from 'react';
import {
  Activity,
  Bed,
  Droplet,
  Wind,
  Truck,
  ShieldCheck,
  PhoneCall,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Stethoscope,
  Users,
  Mail,
  Phone,
  ExternalLink,
  ChevronRight,
  Heart,
  X
} from 'lucide-react';

interface LandingPageProps {
  onStartEmergency: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartEmergency,
  onOpenLogin,
  onOpenSignup
}) => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-teal-100 selection:text-teal-900">
      {/* 1. TOP EMERGENCY DISCLAIMER STRIP */}
      <div className="bg-orange-600 text-white text-xs px-4 py-2 font-medium flex items-center justify-center gap-2 text-center shadow-xs">
        <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
        <span>
          <strong>Emergency Disclaimer:</strong> CareBridge is an emergency healthcare resource coordination platform. For life-threatening emergencies requiring national public dispatch, dial <strong>108 / 112</strong> immediately.
        </span>
      </div>

      {/* 2. PUBLIC HEADER & NAVIGATION */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0D9488] to-[#0284C7] p-2 flex items-center justify-center shadow-sm">
              <Activity className="w-6 h-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                Care<span className="text-teal-600">Bridge</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-teal-50 text-teal-700 ml-2 border border-teal-200">
                Network
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-600">
            <a href="#home" className="hover:text-teal-600 transition-colors">Home</a>
            <a href="#about" className="hover:text-teal-600 transition-colors">About Us</a>
            <a href="#how-it-works" className="hover:text-teal-600 transition-colors">How It Works</a>
            <a href="#services" className="hover:text-teal-600 transition-colors">Services</a>
            <a href="#contact" className="hover:text-teal-600 transition-colors">Contact</a>
          </div>

          {/* Auth Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenLogin}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Log In
            </button>
            <button
              onClick={onOpenSignup}
              className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors"
            >
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* 3. HERO SECTION */}
      <section id="home" className="relative overflow-hidden bg-gradient-to-b from-teal-950 via-[#0F4C81] to-slate-900 text-white py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-teal-300">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            Verified Emergency Healthcare Coordination Platform
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight max-w-4xl mx-auto">
            When Seconds Count, <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-sky-200 to-orange-300">
              Find & Coordinate Resources Instantly
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            CareBridge connects emergency patients, hospitals, blood banks, oxygen depots, and ambulance fleets in a unified real-time coordination room.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
            <button
              onClick={onStartEmergency}
              className="w-full sm:w-auto px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white text-sm sm:text-base font-bold rounded-2xl shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              <Activity className="w-5 h-5" />
              Emergency Resource Requisition
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenLogin}
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white text-sm sm:text-base font-bold rounded-2xl border border-white/30 backdrop-blur-md transition-all flex items-center justify-center gap-2"
            >
              <Building2 className="w-5 h-5 text-teal-300" />
              Healthcare Provider Portal
            </button>
          </div>

          {/* Trust Metrics */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-slate-300">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-teal-400" /> Verified Healthcare Facilities</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-teal-400" /> Real-Time Status Telemetry</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-teal-400" /> City & Regional Dispatch</span>
          </div>
        </div>
      </section>

      {/* 4. ABOUT US SECTION */}
      <section id="about" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-4">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">About CareBridge</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Bridging Critical Communication Gaps During Medical Emergencies
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                During medical emergencies, families and attendants lose precious time calling hospitals, blood banks, and ambulance operators one by one. Providers simultaneously struggle with uncoordinated arrivals and bed occupancy bottlenecks.
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                CareBridge eliminates this fragmentation. By establishing a shared, verified coordination layer, CareBridge enables instant multi-provider requisitioning: reserve an ICU bed, dispatch a blood transfusion unit, request pressurized oxygen, and deploy an ambulance — all linked to a single emergency case record.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-2xl font-black text-teal-700">100%</div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">Verified Facilities</div>
                  <div className="text-[11px] text-slate-400">Credentialed by coordinators</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-2xl font-black text-orange-600">&lt; 3 mins</div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">Average Allocation</div>
                  <div className="text-[11px] text-slate-400">Direct provider confirmation</div>
                </div>
              </div>
            </div>

            {/* Visual Feature Card */}
            <div className="bg-gradient-to-tr from-teal-900 to-[#0F4C81] text-white p-8 rounded-3xl shadow-xl space-y-6">
              <h3 className="text-lg font-bold">The CareBridge Dual Protocol</h3>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">For Patients & Attendants</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Create an emergency case with symptoms and triage priority. View real-time provider distance, submit requisitions, and track acceptance status in real time.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">For Healthcare Providers</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Hospitals, blood banks, oxygen distributors, and ambulance fleets manage capacity and accept or decline incoming requisitions with instant patient feedback.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">For Attending Physicians</h4>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      Hospital doctors review incoming triage cases, attach electronic clinical notes, and document patient vitals prior to emergency admission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HOW IT WORKS SECTION */}
      <section id="how-it-works" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">Protocol Execution</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">How CareBridge Works</h2>
            <p className="text-xs sm:text-sm text-slate-500">Four seamless steps from emergency trigger to verified care delivery.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs relative space-y-2">
              <div className="text-2xl font-black text-teal-600 font-mono">01</div>
              <h3 className="font-bold text-slate-900 text-base">Emergency Intake</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Patient or family enters incident address, symptoms, and urgency level to generate an authenticated Case ID.
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs relative space-y-2">
              <div className="text-2xl font-black text-teal-600 font-mono">02</div>
              <h3 className="font-bold text-slate-900 text-base">Resource Requisition</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Filter nearby facilities by verified availability: ICU beds, blood group units, oxygen cylinders, or ambulances.
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs relative space-y-2">
              <div className="text-2xl font-black text-teal-600 font-mono">03</div>
              <h3 className="font-bold text-slate-900 text-base">Provider Confirmation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Facility administrators review the emergency intake and accept with bed reservation or dispatch.
              </p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs relative space-y-2">
              <div className="text-2xl font-black text-teal-600 font-mono">04</div>
              <h3 className="font-bold text-slate-900 text-base">Live Telemetry</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                7-step ambulance tracking stepper, driver contact info, and physician notes update on the patient's dashboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. SERVICES SECTION */}
      <section id="services" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">Coordinated Healthcare Services</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Critical Medical Infrastructure</h2>
            <p className="text-xs sm:text-sm text-slate-500">Every resource essential for emergency intervention in one unified network.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-100 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Bed className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Hospital & ICU Beds</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Self-reported live bed occupancy, ventilators, and intensive care units with instant triage admission.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-rose-50/70 border border-rose-100 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                <Droplet className="w-6 h-6 fill-white/20" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Blood Bank Inventory</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                All 8 blood groups (A+, A-, B+, B-, AB+, AB-, O+, O-) stock levels with real-time reservation and automatic unit decrement.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <Wind className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Medical Oxygen Supply</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Direct requisition of medical D-type cylinders and 10 LPM electric concentrators with optional delivery.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Ambulance Telemetry</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ALS and BLS fleet management with 7-step status advancement (Dispatched → En Route → Arrived → Delivered).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CONTACT & HELPLINE SECTION */}
      <section id="contact" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-bold text-teal-700 uppercase tracking-widest">Emergency & Support Contact</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Reach the Coordination Command</h2>
            <p className="text-xs sm:text-sm text-slate-500">24/7 dedicated channels for patients, attendant inquiries, and facility onboarding.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
                <PhoneCall className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">National Emergency Services</h3>
              <p className="text-xs text-slate-500">For life-threatening medical dispatch:</p>
              <div className="text-xl font-mono font-extrabold text-red-600">108 / 112</div>
              <p className="text-[11px] text-slate-400">Available 24 hours round the clock</p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-600 mx-auto flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">CareBridge Coordinator Desk</h3>
              <p className="text-xs text-slate-500">Facility allocations & support line:</p>
              <div className="text-lg font-mono font-bold text-teal-700">+91 800 227 3274</div>
              <p className="text-[11px] text-slate-400">Hubballi & Karnataka Central Command</p>
            </div>

            <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Provider Onboarding</h3>
              <p className="text-xs text-slate-500">Hospital & blood bank registry:</p>
              <div className="text-sm font-semibold text-blue-700">facilities@carebridge.org</div>
              <p className="text-[11px] text-slate-400">Verification within 2 hours</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. PROFESSIONAL FOOTER */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500 p-1.5 flex items-center justify-center text-slate-950 font-bold">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-base font-bold text-white tracking-tight">CareBridge</span>
                <span className="text-slate-500 ml-2">Healthcare Technologies</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <button onClick={() => setShowTermsModal(true)} className="hover:text-white transition-colors">
                Terms of Service
              </button>
              <button onClick={() => setShowPrivacyModal(true)} className="hover:text-white transition-colors">
                Privacy Policy
              </button>
              <a href="#services" className="hover:text-white transition-colors">Emergency Directory</a>
              <a href="#contact" className="hover:text-white transition-colors">Support Helpline</a>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 text-center text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              © 2026 CareBridge Healthcare Network. All rights reserved.
            </div>
            <div>
              Protected by Enterprise Health Data Encryption • Cloud Firestore Security Rules
            </div>
          </div>
        </div>
      </footer>

      {/* TERMS OF SERVICE MODAL */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-slate-800 text-xs max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">CareBridge Terms of Service</h3>
              <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 leading-relaxed text-slate-600">
              <p>
                <strong>1. Nature of the Platform:</strong> CareBridge is an emergency healthcare resource coordination software platform designed to assist patients, attendants, and verified healthcare providers. CareBridge does not operate as an emergency medical dispatcher, ambulance fleet owner, or hospital facility.
              </p>
              <p>
                <strong>2. Emergency Disclaimers:</strong> In life-threatening emergencies, users are advised to contact national emergency services (108 / 112) immediately.
              </p>
              <p>
                <strong>3. Self-Reported Availability:</strong> Resource availability figures (bed counts, blood units, and oxygen cylinders) are self-reported by respective verified providers. CareBridge provides timestamp warnings for stale information.
              </p>
              <p>
                <strong>4. User Conduct:</strong> Unauthorized attempts to escalate roles, submit fraudulent emergency calls, or interfere with ambulance telemetry are strictly prohibited.
              </p>
            </div>
            <button
              onClick={() => setShowTermsModal(false)}
              className="w-full py-2 bg-teal-600 text-white font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* PRIVACY POLICY MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-slate-800 text-xs max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">CareBridge Privacy Policy</h3>
              <button onClick={() => setShowPrivacyModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 leading-relaxed text-slate-600">
              <p>
                <strong>1. Data Minimization:</strong> CareBridge collects only data necessary to facilitate emergency healthcare coordination: patient demographics, clinical symptoms, and attendant contact details.
              </p>
              <p>
                <strong>2. Access Control:</strong> Patient records and emergency case files are accessible only to the authenticated patient, recipient healthcare providers who accept the case, and authorized administrative coordinators.
              </p>
              <p>
                <strong>3. Security Safeguards:</strong> User authentication and database records are governed by Cloud Firestore security rules. Passwords are never stored in plaintext and are protected by Firebase Authentication.
              </p>
            </div>
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-2 bg-teal-600 text-white font-bold rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
