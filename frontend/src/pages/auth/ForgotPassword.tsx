import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import api from '../../services/api';

export default function ForgotPasswordPage() {
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

    const onSubmit = async (data: { email: string }) => {
        setIsLoading(true);
        try {
            await api.post('/auth/forgot-password', { email: data.email });
        } catch {
            // Always show success to prevent email enumeration
        } finally {
            setIsLoading(false);
            setSubmitted(true);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Signature Shades</h1>
                </div>
                <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Reset your password</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Enter your email and we'll send a reset link.
                        </p>
                    </div>

                    {submitted ? (
                        <div className="space-y-4 text-center">
                            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
                                If that email is registered, a reset link has been generated. Please contact your administrator or check the system logs.
                            </div>
                            <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500 block">
                                ← Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@company.com"
                                    {...register('email', { required: 'Email is required' })}
                                />
                                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                            </div>
                            <Button type="submit" className="w-full" disabled={isLoading}>
                                {isLoading ? 'Sending...' : 'Send reset link'}
                            </Button>
                            <div className="text-center">
                                <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500">
                                    ← Back to sign in
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
