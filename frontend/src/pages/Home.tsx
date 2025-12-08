import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  VideoCameraIcon, 
  ShieldCheckIcon, 
  UserGroupIcon, 
  ClockIcon,
  ArrowRightIcon,
  PlayIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

const Home: React.FC = () => {
  const features = [
    {
      icon: VideoCameraIcon,
      title: 'HD Video Quality',
      description: 'Crystal clear video with adaptive bandwidth for seamless meetings'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Secure & Private',
      description: 'End-to-end encryption keeps your conversations confidential'
    },
    {
      icon: UserGroupIcon,
      title: 'Team Collaboration',
      description: 'Share screens, files, and collaborate in real-time'
    },
    {
      icon: ClockIcon,
      title: 'Schedule Meetings',
      description: 'Plan ahead with calendar integration and reminders'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Johnson',
      role: 'Product Manager',
      content: 'AI Meet has transformed our remote meetings. The quality is exceptional!',
      rating: 5
    },
    {
      name: 'Michael Chen',
      role: 'CEO',
      content: 'Best video conferencing platform we\'ve used. Reliable and feature-rich.',
      rating: 5
    },
    {
      name: 'Emily Davis',
      role: 'Designer',
      content: 'The interface is intuitive and the video quality is outstanding.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-accent-700">
      <div className="absolute inset-0 bg-black/20"></div>
      
      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <VideoCameraIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">AI Meet</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link
              to="/login"
              className="text-white/90 hover:text-white transition-colors font-medium"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="bg-white text-primary-700 px-6 py-2 rounded-lg font-semibold hover:bg-white/90 transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold text-white mb-6"
          >
            Advanced Video
            <span className="block text-accent-300">Conferencing</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-white/90 mb-8 max-w-2xl mx-auto"
          >
            Connect with your team in stunning HD quality. Experience seamless video meetings 
            with AI-powered features that make collaboration effortless.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/register"
              className="bg-white text-primary-700 px-8 py-4 rounded-lg font-semibold hover:bg-white/90 transition-all flex items-center justify-center group"
            >
              Start Free Trial
              <ArrowRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="bg-white/10 text-white px-8 py-4 rounded-lg font-semibold border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
            >
              <PlayIcon className="w-5 h-5 mr-2" />
              Sign In
            </Link>
          </motion.div>
        </div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
              className="glass-effect rounded-xl p-6 text-center"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-white/80 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold text-white mb-12">Trusted by Thousands</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.2 + index * 0.1 }}
                className="glass-effect rounded-xl p-6 text-left"
              >
                <div className="flex mb-3">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarSolidIcon key={i} className="w-5 h-5 text-yellow-400" />
                  ))}
                </div>
                <p className="text-white/90 mb-4">"{testimonial.content}"</p>
                <div>
                  <p className="text-white font-semibold">{testimonial.name}</p>
                  <p className="text-white/70 text-sm">{testimonial.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="text-center"
        >
          <div className="glass-effect rounded-2xl p-12 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Transform Your Meetings?
            </h2>
            <p className="text-white/90 mb-8 text-lg">
              Join thousands of teams who've already upgraded their video conferencing experience.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="bg-white text-primary-700 px-8 py-4 rounded-lg font-semibold hover:bg-white/90 transition-all"
              >
                Create Free Account
              </Link>
              <Link
                to="/login"
                className="bg-white/10 text-white px-8 py-4 rounded-lg font-semibold border border-white/20 hover:bg-white/20 transition-all"
              >
                Sign In to Existing Account
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
