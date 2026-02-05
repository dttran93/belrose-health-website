import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
  Users,
  Hospital,
  Microscope,
  CircleCheckBig,
  BriefcaseBusiness,
  Mailbox,
  ChevronDown,
} from 'lucide-react';
import DropdownMenu, { DropdownItem } from '@/components/ui/DropdownMenu';
import NavCard from '@/components/site/ui/NavCard';

interface DropdownCategory {
  items: DropdownItem[];
}

interface DropdownConfig {
  'who-we-serve': DropdownCategory;
  company: DropdownCategory;
}

export type DropdownName = 'who-we-serve' | 'company';

type MobileAccordionName = DropdownName | null;

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownName | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState<MobileAccordionName>(null);
  const navigate = useNavigate();

  const handleMouseEnter = (dropdownName: DropdownName) => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setActiveDropdown(dropdownName);
  };

  const handleMouseLeave = () => {
    const timeout = setTimeout(() => {
      setActiveDropdown(null);
    }, 100); // 100ms delay
    setDropdownTimeout(timeout);
  };

  const toggleMobileAccordion = (accordionName: DropdownName) => {
    setMobileAccordionOpen(mobileAccordionOpen === accordionName ? null : accordionName);
  };

  const dropdownConfig: DropdownConfig = {
    'who-we-serve': {
      items: [
        {
          icon: <Users size={32} />,
          title: 'Patients',
          description: 'Get incentivized to compile, manage, and own your health data.',
          link: '#',
          color: 'complement-2',
        },
        {
          icon: <Hospital size={32} />,
          title: 'Healthcare Providers',
          description:
            'Finally have complete patient records without implementation or privacy issues.',
          link: '#',
          color: 'complement-3',
        },
        {
          icon: <Microscope size={32} />,
          title: 'Everyone Else',
          description:
            'Need health data for research, policy, or anything else? Get it directly from patients.',
          link: '#',
          color: 'complement-4',
        },
      ],
    },
    company: {
      items: [
        {
          icon: <CircleCheckBig size={32} />,
          title: 'About',
          description: "Learn about Belrose's team, mission, and values.",
          link: '#',
          color: 'supplement-1',
        },
        {
          icon: <BriefcaseBusiness size={32} />,
          title: 'Careers',
          description: 'Join the team looking to revolutionize health data.',
          link: '#',
          color: 'supplement-2',
        },
        {
          icon: <Mailbox size={32} />,
          title: 'Contact',
          description: 'Get in touch with us for questions or support.',
          link: '#',
          color: 'supplement-3',
        },
      ],
    },
  };

  return (
    <nav className="bg-background/80 backdrop-blur-md py-4 sticky top-0 z-50 border-b border-gray-100">
      <div className="container mx-auto flex justify-between items-center px-4 md:px-6">
        <div className="flex items-center">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center"></div>{' '}
            {/* Placeholder for logo icon */}
            <span className="text-xl font-semibold text-gray-900">Belrose</span>
          </a>
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center space-x-8">
          <DropdownMenu
            name="who-we-serve"
            label="Who We Serve"
            href="#who-we-serve"
            items={dropdownConfig['who-we-serve'].items}
            isOpen={activeDropdown === 'who-we-serve'}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />

          <a href="#how-it-works" className="nav-link">
            How It Works
          </a>

          <DropdownMenu
            name="company"
            label="Company"
            href="#company"
            items={dropdownConfig['company'].items}
            isOpen={activeDropdown === 'company'}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          />

          <a href="#faq" className="nav-link">
            FAQ
          </a>
          <Button variant="outline" onClick={() => navigate('/auth')}>
            Log In
          </Button>
          <Button onClick={() => navigate('/auth', { state: { showRegistration: true } })}>
            Get Started
          </Button>
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden relative w-8 h-8 flex flex-col justify-center items-center pr-6"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <div className="flex flex-col justify-center items-center space-y-1">
            <span
              className={`block h-0.5 w-5 bg-gray-600 transition-all duration-300 ease-in-out ${
                isMenuOpen ? 'rotate-45 translate-y-1.5' : ''
              }`}
            ></span>
            <span
              className={`block h-0.5 w-5 bg-gray-600 transition-all duration-300 ease-in-out ${
                isMenuOpen ? 'opacity-0' : 'opacity-100'
              }`}
            ></span>
            <span
              className={`block h-0.5 w-5 bg-gray-600 transition-all duration-300 ease-in-out ${
                isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
              }`}
            ></span>
          </div>
        </button>
      </div>

      {/* Mobile navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-background border-t border-gray-100 py-4 px-6 absolute w-full shadow-md top-full left-0 max-h-screen overflow-y-auto">
          <div className="flex flex-col space-y-4">
            <div className="border-b border-b-border">
              <div
                className="flex justify-between"
                onClick={() => toggleMobileAccordion('who-we-serve')}
              >
                <a href="#features" className="text-foreground font-medium pb-3">
                  Who We Serve
                </a>
                <ChevronDown
                  className={`transform transition-transform duration-200 ${
                    mobileAccordionOpen === 'who-we-serve' ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {mobileAccordionOpen === 'who-we-serve' && (
                <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-1 mb-3">
                  {dropdownConfig['who-we-serve'].items.map((item, index) => (
                    <div key={index} className="max-h-48 overflow-hidden">
                      <NavCard
                        icon={item.icon}
                        title={item.title}
                        description={item.description}
                        link={item.link}
                        color={item.color}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="flex items-start border-b border-b-border"
              onClick={() => setIsMenuOpen(false)}
            >
              <a href="#how-it-works" className="text-foreground font-medium pb-3">
                How It Works
              </a>
            </div>

            <div className="border-b border-b-border">
              <div
                className="flex justify-between"
                onClick={() => toggleMobileAccordion('company')}
              >
                <a href="#features" className="text-foreground font-medium pb-3">
                  Company
                </a>
                <ChevronDown
                  className={`transform transition-transform duration-200 ${
                    mobileAccordionOpen === 'company' ? 'rotate-180' : ''
                  }`}
                />
              </div>

              {mobileAccordionOpen === 'company' && (
                <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-1 mb-3">
                  {dropdownConfig['company'].items.map((item, index) => (
                    <div key={index} className="max-h-48 overflow-hidden">
                      <NavCard
                        icon={item.icon}
                        title={item.title}
                        description={item.description}
                        link={item.link}
                        color={item.color}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="flex items-start border-b border-b-border"
              onClick={() => setIsMenuOpen(false)}
            >
              <a href="#faq" className="text-foreground font-medium pb-3">
                FAQ
              </a>
            </div>

            <Button variant="outline" onClick={() => navigate('/auth')}>
              Log In
            </Button>
            <Button onClick={() => navigate('/auth', { state: { showRegistration: true } })}>
              Get Started
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
