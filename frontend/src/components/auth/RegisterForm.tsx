import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Link, useNavigate } from 'react-router-dom';
import { RegisterCredentials } from '../../types/auth';

export function RegisterForm() {
    const { register: registerUser } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors }, watch } = useForm<RegisterCredentials & { confirmPassword: string }>();
    const password = watch('password');

    const onSubmit = async (data: RegisterCredentials & { confirmPassword: string }) => {
        setIsLoading(true);
        try {
            await registerUser(data);
            navigate('/dashboard');
        } catch (error) {
            console.error('Registration failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-md">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900">Create an account</h2>
                <p className="mt-2 text-sm text-gray-600">
                    Already have an account? <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">Sign in</Link>
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            placeholder="John Doe"
                            {...register('name', { required: 'Name is required' })}
                        />
                        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            {...register('email', {
                                required: 'Email is required',
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: "Invalid email address"
                                }
                            })}
                        />
                        {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input
                            id="phone"
                            placeholder="0400 000 000"
                            {...register('phone', { required: 'Phone is required' })}
                        />
                        {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="company">Company (Optional)</Label>
                        <Input
                            id="company"
                            placeholder="Your Business Name"
                            {...register('company')}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                            id="address"
                            placeholder="123 Business St"
                            {...register('address', { required: 'Address is required' })}
                        />
                        {errors.address && <p className="text-sm text-red-500">{errors.address.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                {...register('password', {
                                    required: 'Password is required',
                                    minLength: { value: 6, message: 'Min 6 characters' }
                                })}
                            />
                            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                placeholder="••••••••"
                                {...register('confirmPassword', {
                                    required: 'Confirm Password is required',
                                    validate: value => value === password || "Passwords do not match"
                                })}
                            />
                            {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                        </div>
                    </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Creating account...' : 'Create account'}
                </Button>
            </form>
        </div>
    );
}
