"use client"

import * as React from "react"

import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"

interface ResponsiveModalProps {
    children: React.ReactNode
    trigger?: React.ReactNode
    title?: string
    description?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    contentClassName?: string
    showDefaultMobileFooter?: boolean
}

export function ResponsiveModal({
    children,
    trigger,
    title,
    description,
    open,
    onOpenChange,
    contentClassName,
    showDefaultMobileFooter = true,
}: ResponsiveModalProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)")

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className={contentClassName}>
                    <DialogHeader>
                        {title && <DialogTitle>{title}</DialogTitle>}
                        {description && <DialogDescription>{description}</DialogDescription>}
                    </DialogHeader>
                    {children}
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerTrigger asChild>{trigger}</DrawerTrigger>
            <DrawerContent className={contentClassName}>
                {(title || description) && (
                    <DrawerHeader className="text-left">
                        {title && <DrawerTitle>{title}</DrawerTitle>}
                        {description && <DrawerDescription>{description}</DrawerDescription>}
                    </DrawerHeader>
                )}
                <div className="max-h-[85dvh] overflow-y-auto px-4 pb-4">
                    {children}
                </div>
                {showDefaultMobileFooter && (
                    <DrawerFooter className="pt-2">
                        <DrawerClose asChild>
                            <Button variant="outline">Cerrar</Button>
                        </DrawerClose>
                    </DrawerFooter>
                )}
            </DrawerContent>
        </Drawer>
    )
}
