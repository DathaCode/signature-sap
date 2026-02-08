import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Link, useNavigate } from 'react-router-dom';
import { LoginCredentials } from '../../types/auth';

export function LoginForm() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>();

    const onSubmit = async (data: LoginCredentials) => {
        setIsLoading(true);
        try {
            await login(data);
            navigate('/dashboard'); // User dashboard
        } catch (error) {
            console.error('Login failed', error);
        } finally {
            setIsLoading(false);
        }
    };

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
                        <Label htmlFor="password">Password</Label>
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
