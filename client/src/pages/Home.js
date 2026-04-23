import React, { useState, useEffect } from 'react';
import { useAudit } from '../contexts/AuditContext';
import { ExclamationTriangleIcon, SparklesIcon, ChartBarIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '../components/LoadingSpinner';
import AeoReportPage from './AeoReportPage';

export const Home = () => {
  const { error, isLoading, clearError, startAudit } = useAudit();
  const [domain, setDomain] = useState('https://www.aloyoga.com');
  const [brand, setBrand] = useState('Alo Yoga');
  const [geo, setGeo] = useState('United States');
  const [siteTypes, setSiteTypes] = useState([]); // Array of site types
  const [allSiteTypes, setAllSiteTypes] = useState([]); // All available site types
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [auditData, setAuditData] = useState(null);

  // Format snake_case to Title Case
  const formatDisplayText = (snakeCase) => {
    return snakeCase
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Load site types from file
  useEffect(() => {
    const loadSiteTypes = () => {
      try {
        // Import site types directly from the file
        const siteTypesList = `ecommerce
retail_and_apparel
marketplace
saas
subscription_service
brand
hospital
clinic
physician
dentist
optician
podiatrist
chiropractor
physical_therapist
medical_organization
pharmacy
diagnostic_lab
telemedicine
wellness_center
fitness_center
mental_health_service
veterinary
eldercare_facility
childcare
restaurant
fast_food_restaurant
cafe
bakery
bar
winery
brewery
ice_cream_shop
food_establishment
hotel
resort
motel
hostel
bed_breakfast
campground
rv_park
travel_agency
tourist_attraction
store
auto_dealer
furniture_store
electronics_store
clothing_store
jewelry_store
cosmetics,_beauty,_personal_care
book_store
sporting_goods_store
music_store
video_game_store
computer_store
optical_store
antique_store
pawn_shop
convenience_store
liquor_store
hardware_store
garden_store
bike_store
pet_store
toy_store
shopping_center
bank
insurance_agency
accounting_service
attorney
financial_service
real_estate_agent
employment_agency
moving_company
tax_service
consulting_company
marketing_agency
advertising_agency
architect
interior_designer
photographer
graphic_designer
professional_service
educational_organization
school
college_university
preschool
elementary_school
middle_school
high_school
online_course
real_estate_agency
apartment_complex
residence
home_service_business
locksmith
electrician
plumber
hvac_business
roofing_contractor
house_painter
general_contractor
landscaper
pest_control_service
pool_service
appliance_repair
auto_repair
motorcycle_dealer
motorcycle_repair
auto_parts_store
auto_body_shop
auto_wash
tire_shop
car_rental
parking_facility
gas_station
taxi_service
sports_organization
sports_team
sports_club
golf_course
tennis_complex
ski_resort
bowling_alley
stadium
exercise_gym
yoga_studio
public_swimming_pool
sports_activity_location
news_media_organization
radio_station
television_station
movie_theater
entertainment_business
night_club
arcade
art_gallery
museum
performing_group
music_venue
comedy_club
casino
amusement_park
aquarium
zoo
community_center
library
civic_structure
religious_organization
church
mosque
hindu_temple
buddhist_temple
synagogue
animal_shelter
recreation_center
funeral_home
cemetery
local_business
home_and_construction_business
cleaning_service
dry_cleaning_laundry
beauty_salon
hair_salon
day_spa
nail_salon
tattoo_parlor
notary
courier_service
self_storage
recycling_center
printing_service
event_venue
wedding_venue
conference_center
florist
corporation
organization
government_organization
ngo
project
research_organization
emergency_service
fire_station
police_station
hospital_emergency
website
blog
web_page
article
news_article
faq_page
how_to
product
service
course
event
job_posting
recipe
video_object
software_application`;

        const types = siteTypesList.split('\n').filter(type => type.trim());
        console.log('Loaded site types (direct import):', types.length, 'types');
        console.log('First 5 types:', types.slice(0, 5));
        
        setAllSiteTypes(types);
      } catch (error) {
        console.error('Error loading site types:', error);
        // Fallback to basic types
        const fallbackTypes = ['ecommerce', 'saas', 'media', 'bank', 'hospital', 'restaurant', 'store'];
        setAllSiteTypes(fallbackTypes);
        console.log('Using fallback types:', fallbackTypes.length, 'types');
      }
    };
    
    loadSiteTypes();
  }, []);

  // Filter site types based on search
  const filteredSiteTypes = allSiteTypes.filter(type => 
    type.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !siteTypes.includes(type)
  );

  // Add site type to selection
  const addSiteType = (type) => {
    if (siteTypes.length < 3 && !siteTypes.includes(type)) {
      setSiteTypes([...siteTypes, type]);
      setSearchTerm('');
    }
  };

  // Remove site type from selection
  const removeSiteType = (typeToRemove) => {
    setSiteTypes(siteTypes.filter(type => type !== typeToRemove));
  };

  // Handle input change
  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.site-type-dropdown')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!domain.trim() || !brand.trim()) {
      return;
    }

    try {
      clearError();
      console.log(`Starting AEO audit for ${domain.trim()} with brand ${brand.trim()} and site types ${siteTypes.join(', ')}...`);
      
      const data = await startAudit(domain.trim(), brand.trim(), geo.trim(), siteTypes);
      console.log('Raw API response:', data);
      
      setAuditData(data);
      console.log('Audit data set in state:', data);
    } catch (err) {
      console.error('Audit failed:', err.message);
    }
  };

  const handleNewAudit = () => {
    setAuditData(null);
    setDomain('https://www.aloyoga.com');
    setBrand('Alo Yoga');
    setGeo('United States');
    setSiteTypes([]); // Reset site types
    setSearchTerm('');
    clearError();
  };

  // If we have audit data, show the report
  if (auditData) {
    console.log('Home: Rendering AeoReportPage with data:', auditData);
    return <AeoReportPage auditData={auditData} onNewAudit={handleNewAudit} />;
  }

  // Show loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Show the audit form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-3">
                <SparklesIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  1Digitals
                </h1>
                <p className="text-sm font-medium text-gray-600">AI AUDITOR</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">AI-Powered Website Analysis</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-12 items-start">
          {/* Hero Section - Left 2 columns */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                AI-Powered Website Analysis
              </h2>
              <p className="text-xl text-gray-600 mb-2">
                Optimize for Answer Engines & AI Search
              </p>
              <p className="text-gray-500 max-w-3xl text-lg">
                Get comprehensive insights into your website's AI readiness. Analyse domain signals, 
                site structure, and brand visibility across modern AI-powered search platforms.
              </p>
            </div>

            {/* Audit Form */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* First Row - Website URL and Site Type */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="relative group">
                    <label htmlFor="domain" className="block text-sm font-semibold text-gray-900 mb-2">
                      <span className="flex items-center">
                        <i className="fas fa-globe text-blue-500 mr-2"></i>
                        Website URL
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        id="domain"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                        required
                      />
                      <div className="absolute top-full left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-white text-xs rounded p-2 z-10 w-64 pointer-events-none mt-2">
                        Enter the exact URL you want to analyse (e.g., https://example.com). Make sure it matches the specific website URL you intend to audit.
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
                    <label htmlFor="siteTypes" className="block text-sm font-semibold text-gray-900 mb-2">
                      <span className="flex items-center">
                        <i className="fas fa-store text-blue-500 mr-2"></i>
                        Website Type (Max 3)
                      </span>
                    </label>
                    <div className="relative">
                      {/* Selected Items Display */}
                      <div 
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 min-h-[48px] cursor-pointer"
                        onClick={() => setShowDropdown(!showDropdown)}
                      >
                        {siteTypes.length === 0 ? (
                          <span className="text-gray-500">Select website types...</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {siteTypes.map((type, index) => (
                              <span 
                                key={index}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                              >
                                {formatDisplayText(type)}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSiteType(type);
                                  }}
                                  className="ml-1 text-blue-600 hover:text-blue-800"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Dropdown Arrow */}
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      
                      {/* Dropdown */}
                      {showDropdown && (
                        <div className="site-type-dropdown absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                          {/* Search Input */}
                          <div className="p-3 border-b border-gray-200">
                            <input
                              type="text"
                              placeholder="Search website types..."
                              value={searchTerm}
                              onChange={handleInputChange}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                              autoFocus
                            />
                          </div>
                          
                          {/* Filtered Options */}
                          <div className="max-h-48 overflow-y-auto">
                            {filteredSiteTypes.length === 0 ? (
                              <div className="p-3 text-gray-500 text-sm">
                                {siteTypes.length >= 3 ? 'Maximum 3 selections allowed' : 'No matching website types found'}
                              </div>
                            ) : (
                              filteredSiteTypes.slice(0, 10).map((type, index) => (
                                <div
                                  key={index}
                                  onClick={() => {
                                    addSiteType(type);
                                    setShowDropdown(false);
                                  }}
                                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer text-gray-900 text-sm border-b border-gray-100 last:border-b-0"
                                >
                                  {formatDisplayText(type)}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="absolute top-full left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-white text-xs rounded p-2 z-10 w-64 pointer-events-none mt-2">
                        Select up to 3 categories that best describe your website. Start typing to search and select from suggestions.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Second Row - Brand Name and Geography */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="relative group">
                    <label htmlFor="brand" className="block text-sm font-semibold text-gray-900 mb-2">
                      <span className="flex items-center">
                        <i className="fas fa-trademark text-blue-500 mr-2"></i>
                        Brand Name
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="brand"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="e.g., Alo Yoga"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                        required
                      />
                      <div className="absolute top-full left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-white text-xs rounded p-2 z-10 w-64 pointer-events-none mt-2">
                        Enter the brand name in its correct and widely recognized format (e.g., "Alo Yoga", not "Aloyoga").
                      </div>
                    </div>
                  </div>

                  <div className="relative group">
                    <label htmlFor="geo" className="block text-sm font-semibold text-gray-900 mb-2">
                      <span className="flex items-center">
                        <i className="fas fa-map-marker-alt text-blue-500 mr-2"></i>
                        Brand Geography
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="geo"
                        value={geo}
                        onChange={(e) => setGeo(e.target.value)}
                        placeholder="e.g., United States"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                        required
                      />
                      <div className="absolute top-full left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-800 text-white text-xs rounded p-2 z-10 w-64 pointer-events-none mt-2">
                        Specify the primary region your brand serves (e.g., India, US, Global). Be as specific as possible.
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!domain.trim() || !brand.trim() || siteTypes.length === 0 || isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing Website...
                    </span>
                  ) : (
                    'Start AI Audit'
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-medium">Analysis Error</p>
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Performance Metrics - Right 1 column */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-6">
              <div className="flex items-center mb-6">
                <ChartBarIcon className="h-6 w-6 text-blue-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-900">Performance Metrics</h3>
              </div>
              
              <div className="space-y-4">
                <div className="text-center">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-emerald-700">Excellent</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">90-100%</p>
                  <p className="text-xs text-gray-500">Outstanding AI readiness</p>
                </div>
                <div className="text-center">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-blue-700">Good</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">75-89%</p>
                  <p className="text-xs text-gray-500">Strong optimization</p>
                </div>
                <div className="text-center">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-amber-700">Fair</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">60-74%</p>
                  <p className="text-xs text-gray-500">Room for improvement</p>
                </div>
                <div className="text-center">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-orange-700">Poor</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">40-59%</p>
                  <p className="text-xs text-gray-500">Needs attention</p>
                </div>
                <div className="text-center">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-2">
                    <span className="text-sm font-bold text-red-700">Critical</span>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">0-39%</p>
                  <p className="text-xs text-gray-500">Immediate action required</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Comprehensive Analysis */}
        <div className="hidden">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Comprehensive Analysis</h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our AI auditor evaluates multiple critical aspects of your website's readiness for modern AI search engines
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="bg-blue-100 rounded-lg p-3 mb-4 inline-block">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Domain Optimization</h4>
              <p className="text-gray-600 text-sm">
                Validates robots.txt, LLM.txt, and sitemap configuration for AI crawler accessibility
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="bg-green-100 rounded-lg p-3 mb-4 inline-block">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Site Structure</h4>
              <p className="text-gray-600 text-sm">
                Analysis canonical URLs, JSON-LD structured data, and technical SEO elements
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <div className="bg-purple-100 rounded-lg p-3 mb-4 inline-block">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Brand Intelligence</h4>
              <p className="text-gray-600 text-sm">
                Evaluates brand visibility in AI responses and competitive positioning
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
