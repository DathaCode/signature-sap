import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

interface ResetForm {
    password: string;
    confirmPassword: string;
}

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetForm>();

    const onSubmit = async (data: ResetForm) => {
        if (!token) {
            toast.error('Invalid reset link. Please request a new one.');
            return;
        }
        setIsLoading(true);
        try {
            await api.post('/auth/reset-password', { token, password: data.password });
            toast.success('Password updated! Please sign in.');
            navigate('/login');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Invalid or expired reset link.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center space-y-4">
                    <h2 className="text-xl font-bold text-red-600">Invalid Reset Link</h2>
                    <p className="text-gray-600 text-sm">This reset link is missing a token. Please request a new one.</p>
                    <Link to="/forgot-password">
                        <Button variant="outline">Request new link</Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="w-full max-w-md">
                <div className="flex justify-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Signature Shades</h1>
                </div>
                <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Set new password</h2>
                        <p className="mt-2 text-sm text-gray-600">Enter your new password below.</p>
                    </div>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                {...register('password', {
                                    required: 'Password is required',
                                    minLength: { value: 6, message: 'Password must be at least 6 characters' }
                                })}
                            />
                            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                {...register('confirmPassword', {
                                    required: 'Please confirm your password',
                                    validate: (val) => val === watch('password') || 'Passwords do not match',
                                })}
                            />
                            {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Updating...' : 'Update password'}
                        </Button>
                        <div className="text-center">
                            <Link to="/login" className="text-sm text-blue-600 hover:text-blue-500">
                                ← Back to sign in
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
