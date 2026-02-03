"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Copy, Check } from "lucide-react";

interface PasswordGeneratorProps {
    value: string;
    onChange: (password: string) => void;
}

export function PasswordGenerator({ value, onChange }: PasswordGeneratorProps) {
    const [copied, setCopied] = useState(false);
    const [options, setOptions] = useState({
        length: 12,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
    });

    const generatePassword = () => {
        let charset = "";
        if (options.lowercase) charset += "abcdefghijklmnopqrstuvwxyz";
        if (options.uppercase) charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (options.numbers) charset += "0123456789";
        if (options.symbols) charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";

        if (charset === "") charset = "abcdefghijklmnopqrstuvwxyz";

        let password = "";
        for (let i = 0; i < options.length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        onChange(password);
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    const getPasswordStrength = (password: string): {
        strength: number;
        label: string;
        color: string;
    } => {
        if (!password) return { strength: 0, label: "", color: "" };

        let strength = 0;
        if (password.length >= 8) strength += 20;
        if (password.length >= 12) strength += 20;
        if (/[a-z]/.test(password)) strength += 15;
        if (/[A-Z]/.test(password)) strength += 15;
        if (/[0-9]/.test(password)) strength += 15;
        if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

        let label = "Muy débil";
        let color = "bg-red-500";

        if (strength >= 80) {
            label = "Muy fuerte";
            color = "bg-emerald-500";
        } else if (strength >= 60) {
            label = "Fuerte";
            color = "bg-green-500";
        } else if (strength >= 40) {
            label = "Media";
            color = "bg-yellow-500";
        } else if (strength >= 20) {
            label = "Débil";
            color = "bg-orange-500";
        }

        return { strength, label, color };
    };

    const passwordStrength = getPasswordStrength(value);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Contraseña</Label>
                <div className="flex gap-2">
                    <Input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Generar o escribir contraseña"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={generatePassword}
                        title="Generar contraseña"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyToClipboard}
                        title="Copiar contraseña"
                        disabled={!value}
                    >
                        {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                        ) : (
                            <Copy className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Password Strength Indicator */}
            {value && (
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fortaleza:</span>
                        <span className="font-medium">{passwordStrength.label}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all ${passwordStrength.color}`}
                            style={{ width: `${passwordStrength.strength}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Generator Options */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <Label className="text-sm font-medium">Opciones de Generación</Label>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="length" className="text-sm font-normal">
                            Longitud: {options.length}
                        </Label>
                        <input
                            id="length"
                            type="range"
                            min="8"
                            max="32"
                            value={options.length}
                            onChange={(e) =>
                                setOptions({ ...options, length: parseInt(e.target.value) })
                            }
                            className="w-32"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="uppercase" className="text-sm font-normal">
                            Mayúsculas (A-Z)
                        </Label>
                        <Switch
                            id="uppercase"
                            checked={options.uppercase}
                            onCheckedChange={(checked) =>
                                setOptions({ ...options, uppercase: checked })
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="lowercase" className="text-sm font-normal">
                            Minúsculas (a-z)
                        </Label>
                        <Switch
                            id="lowercase"
                            checked={options.lowercase}
                            onCheckedChange={(checked) =>
                                setOptions({ ...options, lowercase: checked })
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="numbers" className="text-sm font-normal">
                            Números (0-9)
                        </Label>
                        <Switch
                            id="numbers"
                            checked={options.numbers}
                            onCheckedChange={(checked) =>
                                setOptions({ ...options, numbers: checked })
                            }
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="symbols" className="text-sm font-normal">
                            Símbolos (!@#$...)
                        </Label>
                        <Switch
                            id="symbols"
                            checked={options.symbols}
                            onCheckedChange={(checked) =>
                                setOptions({ ...options, symbols: checked })
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
