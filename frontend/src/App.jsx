import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

// Layouts
import Navbar from './components/Navbar'
import Footer from './components/Footer'

// Pages
import Home from './pages/Home'
import Browse from './pages/Browse'
import PropertyDetail from './pages/PropertyDetail'
import Booking from './pages/Booking'
import Payment from './pages/Payment'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'

import './index.css'

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-neutral-50">
        <Navbar />
        
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/booking/:propertyId" element={<Booking />} />
            <Route path="/payment/:bookingId" element={<Payment />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <Footer />
        
        <Toaster position="top-right" />
      </div>
    </Router>
  )
}

export default App
