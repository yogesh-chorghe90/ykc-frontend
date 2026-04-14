import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { authService } from '../services/auth.service'
import API_BASE_URL from '../config/api'
import PasswordInput from '../components/PasswordInput'

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: '',
    franchiseId: '',
  })
  const [franchises, setFranchises] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Fetch active franchises for signup (public endpoint - no auth required)
    const fetchFranchises = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/franchises/active`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch franchises')
        }

        const result = await response.json()
        const data = result.data || result || []
        setFranchises(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error('Error fetching franchises:', err)
        // Don't set error here, just log it - user can still try to signup
      }
    }

    fetchFranchises()
  }, [])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!formData.role) {
      setError('Please select a role')
      return
    }

    // Validate franchise selection for roles that require it
    const rolesRequiringFranchise = ['agent', 'franchise']
    if (rolesRequiringFranchise.includes(formData.role) && !formData.franchiseId) {
      setError('Please select a franchise')
      return
    }

    setLoading(true)

    try {
      const { franchiseId, ...signupData } = formData

      // Map form fields to backend expected format
      const registerData = {
        name: signupData.name,
        email: signupData.email,
        mobile: signupData.phone,
        password: signupData.password,
        role: signupData.role,
      }

      // Add franchise only if provided
      if (franchiseId) {
        registerData.franchise = franchiseId
      }

      const response = await api.auth.register(registerData)

      // Backend returns: { success: true, data: user, token }
      if (response.success && response.token) {
        // Store token
        authService.setToken(response.token)

        // Store user data
        if (response.data) {
          authService.setUser(response.data)
        }

        // Redirect to dashboard
        navigate('/')
        setTimeout(() => {
          window.location.reload()
        }, 100)
      } else {
        setError('Signup failed. Invalid response from server.')
      }
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
      console.error('Signup error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo.webp" alt="YKC FINSERV" className="h-16 w-auto object-contain" />
          </div>
          <h2 className="text-3xl font-bold text-primary-900 mb-2">
            Create Your Account
          </h2>
          <p className="text-sm text-gray-600">
            Join YKC FINSERV today
          </p>
        </div>

        {/* Signup Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-md flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-semibold text-gray-700 mb-2">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 bg-white"
                >
                  <option value="">Select a role</option>
                  <option value="agent">Partner</option>
                  <option value="franchise">Franchise Owner</option>
                  <option value="relationship_manager">Relationship Manager</option>
                  <option value="accounts_manager">Accounts Manager</option>
                </select>
              </div>
              <div>
                <label htmlFor="franchiseId" className="block text-sm font-semibold text-gray-700 mb-2">
                  Franchise {(formData.role === 'agent' || formData.role === 'franchise') && <span className="text-red-500">*</span>}
                </label>
                <select
                  id="franchiseId"
                  name="franchiseId"
                  required={formData.role === 'agent' || formData.role === 'franchise'}
                  value={formData.franchiseId}
                  onChange={handleChange}
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 bg-white"
                >
                  <option value="">Select a franchise</option>
                  {franchises.map((franchise) => (
                    <option key={franchise.id || franchise._id} value={franchise.id || franchise._id}>
                      {franchise.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Password (min 6 characters)"
                  className="block w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-base font-semibold rounded-lg text-white bg-primary-900 hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Creating account...</span>
                  </>
                ) : (
                  <span>Sign Up</span>
                )}
              </button>
            </div>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-primary-900 hover:text-primary-800 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Signup
