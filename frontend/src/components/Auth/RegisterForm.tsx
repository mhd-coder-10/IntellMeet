// Registration form with email OTP verification
// Validates inputs, dispatches 6-digit verification code via email, and completes registration

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, Mail, ArrowLeft, CheckCircle2, RefreshCw, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { signup as signupApi, sendSignupOtp } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers and underscore'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
})

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterForm() {
    const [step, setStep] = useState<1 | 2>(1)
    const [isLoading, setIsLoading] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [otpCode, setOtpCode] = useState('')
    const [otpError, setOtpError] = useState('')
    const [resendCooldown, setResendCooldown] = useState(0)

    const navigate = useNavigate()
    const setAuth = useAuthStore((state) => state.setAuth)

    const {
        register,
        getValues,
        trigger,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        mode: 'onTouched',
    })

    // Countdown timer for resend OTP cooldown
    useEffect(() => {
        if (resendCooldown <= 0) return
        const timer = setInterval(() => {
            setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
        }, 1000)
        return () => clearInterval(timer)
    }, [resendCooldown])

    // Step 1: Send OTP to provided email
    const handleSendOtp = async () => {
        const isValid = await trigger(['name', 'username', 'email', 'password'])
        if (!isValid) return

        const { email, name } = getValues()
        setIsLoading(true)
        try {
            await sendSignupOtp({ email, name })
            setOtpCode('')
            toast.success(`Verification code sent to ${email}. Please check your inbox.`)
            setStep(2)
            setResendCooldown(60)
            setOtpError('')
        } catch (error: any) {
            const message =
                error.response?.data?.message || 'Failed to send verification code. Please check your email.'
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    // Resend OTP in Step 2
    const handleResendOtp = async () => {
        if (resendCooldown > 0 || isResending) return
        const { email, name } = getValues()
        setIsResending(true)
        try {
            await sendSignupOtp({ email, name })
            setOtpCode('')
            toast.success('A new verification code has been sent to your email!')
            setResendCooldown(60)
            setOtpError('')
        } catch (error: any) {
            const message =
                error.response?.data?.message || 'Failed to resend code. Please try again.'
            toast.error(message)
        } finally {
            setIsResending(false)
        }
    }

    // Step 2: Verify OTP and Register user
    const handleCompleteRegistration = async (e: React.FormEvent) => {
        e.preventDefault()
        const cleanOtp = otpCode.trim()

        if (!cleanOtp) {
            setOtpError('Please enter the 6-digit verification code')
            return
        }

        if (cleanOtp.length !== 6) {
            setOtpError('Verification code must be exactly 6 digits')
            return
        }

        setIsLoading(true)
        setOtpError('')
        try {
            const formData = getValues()
            const response = await signupApi({
                name: formData.name,
                username: formData.username,
                email: formData.email,
                password: formData.password,
                otp: cleanOtp,
            })
            setAuth(response.user, response.accessToken, response.refreshToken)
            toast.success('Email verified successfully! Welcome to IntellMeet.')
            navigate('/dashboard')
        } catch (error: any) {
            const message =
                error.response?.data?.message || 'Invalid or expired verification code'
            setOtpError(message)
            toast.error(message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {step === 1 ? (
                /* Step 1: User Account Details */
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        handleSendOtp()
                    }}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. John Doe"
                            autoComplete="name"
                            {...register('name')}
                        />
                        {errors.name && (
                            <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            placeholder="e.g. johndoe"
                            autoComplete="username"
                            {...register('username')}
                        />
                        {errors.username && (
                            <p className="text-xs text-red-500 font-medium">{errors.username.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Work or Personal Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="you@company.com"
                            autoComplete="email"
                            {...register('email')}
                        />
                        {errors.email && (
                            <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="At least 6 characters"
                                autoComplete="new-password"
                                className="pr-10"
                                {...register('password')}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4" />
                                ) : (
                                    <Eye className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                        {errors.password && (
                            <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
                        )}
                    </div>

                    <Button type="submit" className="w-full mt-2 gap-2 font-semibold" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Sending Verification Code...
                            </>
                        ) : (
                            <>
                                <Mail className="h-4 w-4" />
                                Verify Email & Continue
                            </>
                        )}
                    </Button>

                    <p className="text-center text-xs text-slate-500 pt-1">
                        Already have an account?{' '}
                        <Link to="/login" className="text-blue-600 font-semibold hover:underline">
                            Login
                        </Link>
                    </p>
                </form>
            ) : (
                /* Step 2: 6-Digit Email OTP Verification */
                <form
                    onSubmit={handleCompleteRegistration}
                    autoComplete="off"
                    className="space-y-5"
                >
                    {/* Hidden inputs to divert aggressive browser password manager autofill */}
                    <input type="text" name="prevent_autofill_user" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="off" />
                    <input type="password" name="prevent_autofill_pwd" className="hidden" tabIndex={-1} aria-hidden="true" autoComplete="off" />

                    {/* Header Banner */}
                    <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mx-auto shadow-xs">
                            <KeyRound className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 text-sm">Enter Verification Code</h4>
                            <p className="text-xs text-slate-600 mt-0.5">
                                We sent a 6-digit verification code to
                            </p>
                            <span className="inline-block mt-1 font-semibold text-blue-700 bg-white border border-blue-200 px-2.5 py-0.5 rounded-md text-xs">
                                {getValues('email')}
                            </span>
                        </div>
                    </div>

                    {/* 6-Digit OTP Input */}
                    <div className="space-y-2">
                        <Label htmlFor="verification_code" className="text-xs font-semibold text-slate-700 block text-center">
                            6-Digit Security Code
                        </Label>
                        <Input
                            key="verification_code_input_field"
                            id="verification_code"
                            name="verification_code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            placeholder="••••••"
                            value={otpCode}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            data-1p-ignore="true"
                            data-lpignore="true"
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                                setOtpCode(val)
                                if (otpError) setOtpError('')
                            }}
                            autoFocus
                            className="text-center text-2xl font-mono tracking-[0.5em] font-bold h-13 border-slate-300 focus:border-blue-500 focus:ring-blue-500 bg-white"
                        />
                        {otpError ? (
                            <p className="text-xs text-red-500 text-center font-medium">{otpError}</p>
                        ) : (
                            <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                Code expires in 10 minutes
                            </p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full gap-2 font-semibold h-11 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        disabled={isLoading || otpCode.length !== 6}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Verifying & Creating Account...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Confirm & Activate Account
                            </>
                        )}
                    </Button>

                    {/* Resend and Back Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <button
                            type="button"
                            onClick={() => {
                                setStep(1)
                                setOtpError('')
                            }}
                            className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Change Email
                        </button>

                        <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resendCooldown > 0 || isResending}
                            className={`font-semibold flex items-center gap-1 transition-colors cursor-pointer ${resendCooldown > 0
                                ? 'text-slate-400 cursor-not-allowed'
                                : 'text-blue-600 hover:text-blue-800'
                                }`}
                        >
                            <RefreshCw className={`w-3 h-3 ${isResending ? 'animate-spin' : ''}`} />
                            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    )
}