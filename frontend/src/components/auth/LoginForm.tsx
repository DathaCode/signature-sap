import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Link, useNavigate } from 'react-router-dom';
import { LoginCredentials } from '../../types/auth';
import { Clock } from 'lucide-react';

export function LoginForm() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>();

    const onSubmit = async (data: LoginCredentials) => {
        setIsLoading(true);
        try {
            await login(data);
            navigate('/dashboard');
        } catch (error: any) {
            const message: string = error?.response?.data?.message || '';
            if (error?.response?.status === 403 && message.toLowerCase().includes('approval')) {
                setPendingApproval(true);
            }
            console.error('Login failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (pendingApproval) {
        return (
            <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-lg shadow-md text-center">
                <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
                        <Clock className="h-8 w-8 text-amber-600" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Account Awaiting Approval</h2>
                <p className="text-gray-600">
                    Your account has been registered but is waiting for administrator approval.
                    You'll be able to sign in once your account is approved.
                </p>
                <p className="text-sm text-gray-500">
                    Please contact your administrator if you need immediate access.
                </p>
                <Button variant="outline" className="w-full" onClick={() => setPendingApproval(false)}>
                    Back to Sign In
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-md">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Sign in to your account</h2>
                <p className="mt-2 text-sm text-gray-600">
                    Or <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">create a new account</Link>
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4">
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

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">
                                Forgot your password?
                            </Link>
                        </div>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            {...register('password', { required: 'Password is required' })}
                        />
                        {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
            </form>
        </div>
    );
}
