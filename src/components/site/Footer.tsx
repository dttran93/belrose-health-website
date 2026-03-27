import React from 'react';
import { HeartPulse } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LinkItem {
  name: string;
  href: string;
}

const Footer: React.FC = () => {
  const currentYear: number = new Date().getFullYear();

  const links = {
    company: [
      { name: 'About Us', href: '/#about' },
      { name: 'Careers', href: '/#who' },
      { name: 'Contact', href: '/#who/contact' },
      { name: 'Privacy', href: '/privacy' },
    ],
    product: [
      { name: 'How It Works', href: '/#how' },
      { name: 'FAQ', href: '/#faq' },
      { name: 'Login', href: '/auth' },
      { name: 'Register', href: '/auth/register' },
    ],
  };

  return (
    <footer className="bg-gray-900 text-gray-300 px-12 py-8">
      <div className="container mx-auto px-4 md:px-6 overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-6 w-full">
          <div className="max-w-md">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 rounded-full bg-health-600 text-white flex items-center justify-center mr-3">
                <HeartPulse size={24} />
              </div>
              <span className="text-2xl font-bold text-white">Belrose Health</span>
            </div>
            <p className="mb-6 text-gray-400 pr-4">
              A technology and incentive infrastructure that gives people sovereignty over their
              health data.
            </p>
          </div>

          <div className="flex gap-12 md:gap-16 justify-center">
            <div>
              <h3 className="font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2">
                {links.company.map((link: LinkItem, index: number) => (
                  <li key={index}>
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2">
                {links.product.map((link: LinkItem, index: number) => (
                  <li key={index}>
                    <Link
                      to={link.href}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-4 mt-4 flex flex-col md:flex-row justify-between">
          <p className="text-gray-400 text-sm">
            &copy; {currentYear} Belrose Health. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
