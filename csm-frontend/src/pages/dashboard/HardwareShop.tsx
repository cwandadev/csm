// csms-frontend/src/pages/dashboard/HardwareShop.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

import {
  ShoppingCart,
  Smartphone,
  Fingerprint,
  CreditCard,
  Truck,
  Shield,
  Star,
  Minus,
  Plus,
  X,
  Check,
  Loader2,
  MapPin,
  Clock,
  RotateCcw,
  Sparkles,
  Zap,
  Phone,
  Mail,
  Store,
  Percent
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSearchParams } from "react-router-dom";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// VAT configuration
const VAT_CONFIG = {
  rate: 18,
  name: 'VAT'
};

interface HardwareProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: "fingerprint_card" | "fingerprint_only" | "accessories";
  features: string[];
  specifications: Record<string, string>;
  stock: number;
  rating: number;
  reviews: number;
  popular?: boolean;
  discount?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const HARDWARE_PRODUCTS: HardwareProduct[] = [
  {
    id: "FP-CARD-001",
    name: "CSM Device: FingerPrint + Card Reader",
    description: "Professional biometric attendance system with RFID card reader.",
    price: 99,
    originalPrice: 129,
    image: "/hardware/fp_card_plus.png",
    category: "fingerprint_card",
    features: [
      "Fingerprint scanner with 0.5s recognition",
      "RFID/NFC card reader (13.56MHz)",
      '2.4" TFT color display',
      "Built-in buzzer and LED indicators",
      "Supports 2000+ users",
      "ESP32 powered WiFi connectivity"
    ],
    specifications: {
      "Processor": "ESP32 Dual-core",
      "Display": '2.4" 320x240 TFT',
      "Fingerprint Sensor": "Optical, 500 DPI",
      "Storage": "4MB Flash",
      "Connectivity": "WiFi 802.11 b/g/n"
    },
    stock: 50,
    rating: 4.8,
    reviews: 127,
    popular: true,
    discount: 23
  },
  {
    id: "FP-ONLY-002",
    name: "CSM Device: FingerPrint Only",
    description: "High-precision fingerprint scanner for secure attendance tracking.",
    price: 90,
    originalPrice: 110,
    image: "/hardware/fp_only.png",
    category: "fingerprint_only",
    features: [
      "Optical fingerprint sensor",
      "0.3s rapid recognition",
      '2.0" TFT display',
      "LED status indicators",
      "Supports 1500+ users",
      "ESP8266 powered"
    ],
    specifications: {
      "Processor": "ESP8266 80MHz",
      "Display": '2.0" 220x176 TFT',
      "Fingerprint Sensor": "Optical, 500 DPI",
      "Storage": "4MB Flash",
      "Connectivity": "WiFi 802.11 b/g/n"
    },
    stock: 75,
    rating: 4.6,
    reviews: 89,
    discount: 18
  },
  {
    id: "CSM-CASE-001",
    name: "CSM Protective Case",
    description: "Durable protective case for CSM devices. IP65 weatherproof.",
    price: 25,
    originalPrice: 35,
    image: "/hardware/case.png",
    category: "accessories",
    features: [
      "IP65 weatherproof rating",
      "Impact-resistant polycarbonate",
      "Wall mounting kit included",
      "Lockable design"
    ],
    specifications: {
      "Material": "Polycarbonate + ABS",
      "Dimensions": "120 x 80 x 40mm",
      "Weight": "250g",
      "IP Rating": "IP65"
    },
    stock: 200,
    rating: 4.5,
    reviews: 34,
  },
  {
    id: "CSM-STAND-001",
    name: "CSM Desktop Stand",
    description: "Ergonomic desktop stand with adjustable angle.",
    price: 15,
    originalPrice: 20,
    image: "/hardware/stand.png",
    category: "accessories",
    features: [
      "Adjustable angle (30°-70°)",
      "Anti-slip rubber base",
      "Cable management channel",
      "Aluminum construction"
    ],
    specifications: {
      "Material": "Aluminum + Silicone",
      "Dimensions": "100 x 80 x 60mm",
      "Weight": "180g",
      "Adjustment": "Manual tilt"
    },
    stock: 150,
    rating: 4.4,
    reviews: 28,
  },
  {
    id: "CSM-POWER-001",
    name: "CSM Power Supply Kit",
    description: "5V/2A power supply with international plug adapters.",
    price: 12,
    originalPrice: 18,
    image: "/hardware/power.png",
    category: "accessories",
    features: [
      "5V/2A regulated output",
      "Over-voltage protection",
      "2m USB cable",
      "5 international plug adapters",
      "CE/FCC certified"
    ],
    specifications: {
      "Input": "100-240V AC, 50/60Hz",
      "Output": "5V DC, 2A",
      "Cable Length": "2m",
      "Connector": "USB Type-C"
    },
    stock: 300,
    rating: 4.7,
    reviews: 56,
  }
];

const ACCESSORIES = HARDWARE_PRODUCTS.filter(p => p.category === "accessories");

interface DeliveryOption {
  id: string;
  name: string;
  price: number;
  estimatedTime: string;
  description: string;
  icon: React.ReactNode;
}

const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "pickup",
    name: "Self Pickup",
    price: 0,
    estimatedTime: "Ready in 1-2 hours",
    description: "Pick up from our Kigali office. No delivery fee.",
    icon: <Store className="h-5 w-5" />
  },
  {
    id: "standard",
    name: "Standard Delivery",
    price: 5,
    estimatedTime: "2-3 business days",
    description: "Tracked delivery to your address",
    icon: <Truck className="h-5 w-5" />
  },
  {
    id: "express",
    name: "Express Delivery",
    price: 15,
    estimatedTime: "Next business day",
    description: "Priority processing and express delivery",
    icon: <Zap className="h-5 w-5" />
  }
];

const PICKUP_LOCATIONS = [
  {
    id: "kigali",
    name: "CSM Kigali Office",
    address: "KG 123 St, Kacyiru, Kigali, Rwanda",
    hours: "Monday-Friday: 8:00 AM - 5:00 PM, Saturday: 9:00 AM - 1:00 PM",
    phone: "+250 788 123 456"
  }
];

interface CartItem {
  product: HardwareProduct;
  quantity: number;
}

interface Order {
  id: string;
  items: CartItem[];
  subtotal: number;
  deliveryCost: number;
  tax: number;
  total: number;
  deliveryMethod: DeliveryOption;
  pickupLocation?: any;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress?: string;
  status: string;
  createdAt: Date;
}

// Payment Form Component
const PaymentForm = ({ 
  amount, 
  orderData, 
  onSuccess, 
  onError, 
  onCancel 
}: { 
  amount: number; 
  orderData: any; 
  onSuccess: (paymentIntentId: string) => void; 
  onError: (error: string) => void;
  onCancel: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const token = localStorage.getItem("csm_token");
        const response = await fetch(`${API_BASE_URL}/hardware/create-payment-intent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            amount: amount,
            currency: "usd",
            orderData: orderData
          })
        });

        const data = await response.json();
        if (data.success) {
          setClientSecret(data.data.client_secret);
        } else {
          onError(data.error || "Failed to initialize payment");
        }
      } catch (error) {
        console.error("Error creating payment intent:", error);
        onError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [amount, orderData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) {
      onError("Payment system not ready");
      return;
    }

    setProcessing(true);

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)!,
        billing_details: {
          name: orderData.customer_name,
          email: orderData.customer_email,
        },
      },
    });

    if (error) {
      console.error("Payment error:", error);
      onError(error.message || "Payment failed");
    } else if (paymentIntent) {
      console.log("Payment intent status:", paymentIntent.status);
      
      if (paymentIntent.status === 'succeeded') {
        console.log("Payment succeeded! ID:", paymentIntent.id);
        onSuccess(paymentIntent.id);
      } else if (paymentIntent.status === 'requires_action') {
        const { error: confirmError, paymentIntent: confirmedIntent } = await stripe.confirmCardPayment(clientSecret);
        if (confirmError) {
          onError(confirmError.message);
        } else if (confirmedIntent?.status === 'succeeded') {
          onSuccess(confirmedIntent.id);
        }
      } else {
        onError(`Payment status: ${paymentIntent.status}`);
      }
    }

    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-background">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                '::placeholder': { color: '#aab7c4' },
              },
              invalid: { color: '#9e2146' },
            },
          }}
        />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!stripe || !clientSecret || processing} className="flex-1 gradient-primary text-primary-foreground">
          {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
          Pay ${amount.toFixed(2)}
        </Button>
      </div>
    </form>
  );
};

const HardwareShop = () => {
  const { admin } = useAuth();
  const [searchParams] = useSearchParams();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "delivery" | "confirmation">("cart");
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryOption>(DELIVERY_OPTIONS[0]);
  const [selectedPickupLocation, setSelectedPickupLocation] = useState(PICKUP_LOCATIONS[0]);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<HardwareProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);
  
  // VAT toggle state - unchecked by default
  const [includeVAT, setIncludeVAT] = useState(false);

  const [deliveryForm, setDeliveryForm] = useState({
    firstName: admin?.firstName || "",
    lastName: admin?.lastName || "",
    email: admin?.email || "",
    phone: "",
    address: "",
    city: "Kigali",
    province: "Kigali"
  });

  // Handle pre-selected device from URL parameters
  useEffect(() => {
    const reSelectCrat = searchParams.get('re-select_crat');
    const deviceId = searchParams.get('device_id');
    
    if (reSelectCrat === 'csm-device-99_added' && deviceId) {
      console.log('[HardwareShop] Pre-selected device detected:', deviceId);
      
      const product = HARDWARE_PRODUCTS.find(p => p.id === deviceId);
      
      if (product) {
        toast.info(`Adding ${product.name} to your cart...`, { duration: 3000 });
        
        setTimeout(() => {
          addToCart(product, 1);
          setShowCart(true);
          
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }, 1000);
      } else {
        console.warn('[HardwareShop] Product not found for device ID:', deviceId);
      }
    }
    
    const selectedDevice = searchParams.get('device');
    const quantity = parseInt(searchParams.get('quantity') || '1');
    
    if (selectedDevice) {
      const product = HARDWARE_PRODUCTS.find(p => p.id === selectedDevice || p.name.toLowerCase().includes(selectedDevice.toLowerCase()));
      
      if (product) {
        toast.info(`${product.name} recommended for your setup!`);
        setTimeout(() => {
          addToCart(product, quantity);
          setShowCart(true);
        }, 500);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    const savedCart = localStorage.getItem("csm_hardware_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to load cart:", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("csm_hardware_cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: HardwareProduct, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    toast.success(`Added ${product.name} to cart`);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    toast.success("Item removed from cart");
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const deliveryCost = selectedDelivery.price;
    const tax = includeVAT ? subtotal * (VAT_CONFIG.rate / 100) : 0;
    return { subtotal, deliveryCost, tax, total: subtotal + deliveryCost + tax };
  };

  const clearCart = () => {
    setCart([]);
    setCheckoutStep("cart");
    toast.info("Cart cleared");
  };

  const handleProceedToCheckout = () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    setCheckoutStep("delivery");
  };

  const handleProceedToPayment = () => {
    if (selectedDelivery.id === "pickup") {
      if (!deliveryForm.firstName || !deliveryForm.lastName || !deliveryForm.email || !deliveryForm.phone) {
        toast.error("Please fill in your contact details");
        return;
      }
    } else {
      if (!deliveryForm.firstName || !deliveryForm.lastName || !deliveryForm.email || 
          !deliveryForm.phone || !deliveryForm.address) {
        toast.error("Please fill in all delivery details");
        return;
      }
    }

    const totals = getCartTotal();
    
    const orderData = {
      organization_id: admin?.organizationId,
      items: cart.map(item => ({
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price
      })),
      subtotal: totals.subtotal,
      delivery_cost: totals.deliveryCost,
      tax: totals.tax,
      total: totals.total,
      delivery_method: selectedDelivery.id,
      customer_name: `${deliveryForm.firstName} ${deliveryForm.lastName}`,
      customer_email: deliveryForm.email,
      customer_phone: deliveryForm.phone,
      delivery_address: selectedDelivery.id !== "pickup" ? `${deliveryForm.address}, ${deliveryForm.city}, ${deliveryForm.province}` : null,
      include_vat: includeVAT,
      vat_rate: includeVAT ? VAT_CONFIG.rate : 0
    };
    
    setPendingOrderData(orderData);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setProcessingOrder(true);
    setShowPaymentModal(false);
    
    toast.loading("Processing your payment...", { id: "payment-processing" });
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const token = localStorage.getItem("csm_token");
      const response = await fetch(`${API_BASE_URL}/hardware/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...pendingOrderData,
          payment_intent_id: paymentIntentId
        })
      });

      const data = await response.json();

      toast.dismiss("payment-processing");

      if (data.success) {
        const totals = getCartTotal();
        const newOrder: Order = {
          id: data.data.order_id.toString(),
          items: [...cart],
          subtotal: totals.subtotal,
          deliveryCost: totals.deliveryCost,
          tax: totals.tax,
          total: totals.total,
          deliveryMethod: selectedDelivery,
          pickupLocation: selectedDelivery.id === "pickup" ? PICKUP_LOCATIONS[0] : undefined,
          customerName: `${deliveryForm.firstName} ${deliveryForm.lastName}`,
          customerEmail: deliveryForm.email,
          customerPhone: deliveryForm.phone,
          deliveryAddress: selectedDelivery.id !== "pickup" ? `${deliveryForm.address}, ${deliveryForm.city}, ${deliveryForm.province}` : undefined,
          status: "processing",
          createdAt: new Date()
        };
        
        setCurrentOrder(newOrder);
        clearCart();
        setCheckoutStep("confirmation");
        toast.success("Payment successful! Order placed successfully!");
      } else {
        toast.error(data.error || "Failed to place order");
      }
    } catch (error) {
      console.error("Order error:", error);
      toast.dismiss("payment-processing");
      toast.error("Failed to place order. Please try again.");
    } finally {
      setProcessingOrder(false);
      setPendingOrderData(null);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
    setShowPaymentModal(false);
    setPendingOrderData(null);
  };

  const handleCancelPayment = () => {
    setShowPaymentModal(false);
    setPendingOrderData(null);
  };

  const handleAddBundle = () => {
    const mainDevice = HARDWARE_PRODUCTS.find(p => p.id === "FP-CARD-001");
    if (mainDevice) {
      addToCart(mainDevice, 1);
      ACCESSORIES.forEach(accessory => {
        addToCart(accessory, 1);
      });
      toast.success("Bundle added with 15% discount applied automatically!");
    }
  };

  const totals = getCartTotal();
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // DELIVERY SCREEN - with modal inside
  if (checkoutStep === "delivery") {
    return (
      <>
        {/* Payment Modal - Rendered here so it appears on top of delivery screen */}
        {showPaymentModal && pendingOrderData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
            <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-heading font-bold">Complete Payment</h2>
                <button onClick={handleCancelPayment} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Order Total</span>
                  <span className="text-2xl font-bold text-primary">${pendingOrderData.total.toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Your card will be charged ${pendingOrderData.total.toFixed(2)}. Payment is secure and encrypted.
                </p>
              </div>
              <PaymentForm
                amount={pendingOrderData.total}
                orderData={pendingOrderData}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handleCancelPayment}
              />
            </div>
          </div>
        )}

        {/* Delivery Screen Content */}
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-heading font-bold">Delivery Options</h1>
              <p className="text-muted-foreground text-sm">Choose how you want to receive your order</p>
            </div>
            <Button variant="ghost" onClick={() => setCheckoutStep("cart")} className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Back to Cart ({cartItemCount})
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Delivery Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={selectedDelivery.id}
                    onValueChange={(val) => setSelectedDelivery(DELIVERY_OPTIONS.find(d => d.id === val) || DELIVERY_OPTIONS[0])}
                  >
                    {DELIVERY_OPTIONS.map((option) => (
                      <div key={option.id} className={`flex items-center justify-between border rounded-lg p-4 mb-3 cursor-pointer transition-all ${selectedDelivery.id === option.id ? 'border-primary bg-primary/5' : ''}`}
                           onClick={() => setSelectedDelivery(option)}>
                        <div className="flex items-start gap-4">
                          <RadioGroupItem value={option.id} id={option.id} />
                          <div>
                            <div className="flex items-center gap-2">
                              {option.icon}
                              <Label htmlFor={option.id} className="font-semibold">{option.name}</Label>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-green-600">
                              <Clock className="h-3 w-3" />
                              {option.estimatedTime}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{option.price === 0 ? 'FREE' : `$${option.price}`}</p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>

              {selectedDelivery.id === "pickup" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      Pickup Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg p-4 bg-primary/5">
                      <p className="font-semibold">{selectedPickupLocation.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">{selectedPickupLocation.address}</p>
                      <p className="text-sm text-muted-foreground mt-1">Hours: {selectedPickupLocation.hours}</p>
                      <p className="text-sm text-muted-foreground mt-1">Phone: {selectedPickupLocation.phone}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Contact Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>First Name</Label>
                      <Input
                        value={deliveryForm.firstName}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, firstName: e.target.value })}
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name</Label>
                      <Input
                        value={deliveryForm.lastName}
                        onChange={(e) => setDeliveryForm({ ...deliveryForm, lastName: e.target.value })}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={deliveryForm.email}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={deliveryForm.phone}
                      onChange={(e) => setDeliveryForm({ ...deliveryForm, phone: e.target.value })}
                      placeholder="+250 788 123 456"
                    />
                  </div>

                  {selectedDelivery.id !== "pickup" && (
                    <>
                      <div className="space-y-2">
                        <Label>Delivery Address</Label>
                        <Input
                          value={deliveryForm.address}
                          onChange={(e) => setDeliveryForm({ ...deliveryForm, address: e.target.value })}
                          placeholder="Street address"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>City</Label>
                          <Input
                            value={deliveryForm.city}
                            onChange={(e) => setDeliveryForm({ ...deliveryForm, city: e.target.value })}
                            placeholder="Kigali"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Province</Label>
                          <Input
                            value={deliveryForm.province}
                            onChange={(e) => setDeliveryForm({ ...deliveryForm, province: e.target.value })}
                            placeholder="Kigali"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex justify-between text-sm">
                        <div className="flex-1">
                          <span className="font-medium">{item.product.name}</span>
                          <span className="text-muted-foreground ml-1">x{item.quantity}</span>
                        </div>
                        <span>${(item.product.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>${totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{selectedDelivery.name}</span>
                      <span>{selectedDelivery.price === 0 ? 'FREE' : `$${totals.deliveryCost.toFixed(2)}`}</span>
                    </div>
                    
                    {/* VAT Toggle Section */}
                    <div className="flex items-center justify-between py-2 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Include {VAT_CONFIG.rate}% {VAT_CONFIG.name}</span>
                      </div>
                      <Switch
                        checked={includeVAT}
                        onCheckedChange={setIncludeVAT}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    
                    {includeVAT && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{VAT_CONFIG.name} ({VAT_CONFIG.rate}%)</span>
                        <span>${totals.tax.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">${totals.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full gradient-primary text-primary-foreground"
                    onClick={handleProceedToPayment}
                    disabled={processingOrder}
                  >
                    {processingOrder ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Proceed to Payment
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By placing your order, you agree to our Terms of Service
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  // CONFIRMATION SCREEN
  if (checkoutStep === "confirmation" && currentOrder) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="border-green-500/30">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-heading font-bold mb-2">Order Confirmed!</h2>
            <p className="text-muted-foreground mb-4">Thank you for your purchase!</p>
            
            <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm font-mono mb-2">Order #{currentOrder.id.slice(0, 8).toUpperCase()}</p>
              <p className="text-sm">💰 Total: <strong>${currentOrder.total.toFixed(2)}</strong></p>
              {currentOrder.tax > 0 && (
                <p className="text-sm text-muted-foreground">Includes {VAT_CONFIG.rate}% {VAT_CONFIG.name}: ${currentOrder.tax.toFixed(2)}</p>
              )}
              {currentOrder.deliveryMethod.id === "pickup" ? (
                <>
                  <p className="text-sm mt-2">📦 Pickup at: <strong>{currentOrder.pickupLocation?.name}</strong></p>
                  <p className="text-sm">📍 {currentOrder.pickupLocation?.address}</p>
                  <p className="text-sm">⏰ Ready in 1-2 hours</p>
                </>
              ) : (
                <p className="text-sm mt-2">🚚 Delivery to: {currentOrder.deliveryAddress}</p>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setCheckoutStep("cart"); setCurrentOrder(null); setCart([]); }}>
                Continue Shopping
              </Button>
              <Button className="gradient-primary text-primary-foreground" onClick={() => window.print()}>
                Download Receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MAIN SHOP SCREEN
  return (
    <div className="space-y-6">
      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-border shadow-xl">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Your Cart ({cartItemCount})
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCart(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Your cart is empty</p>
                  <Button variant="link" onClick={() => setShowCart(false)}>Continue Shopping</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex gap-3 border-b border-border pb-4">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                        <Smartphone className="h-8 w-8 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-primary font-bold text-sm">${item.product.price}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm w-8 text-center">{item.quantity}</span>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive ml-auto" onClick={() => removeFromCart(item.product.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {cart.length > 0 && (
              <div className="border-t border-border p-4 space-y-4">
                <div className="flex justify-between font-bold">
                  <span>Subtotal</span>
                  <span className="text-primary">${totals.subtotal.toFixed(2)}</span>
                </div>
                
                {/* VAT Toggle in Cart Sidebar */}
                <div className="flex items-center justify-between py-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Include {VAT_CONFIG.rate}% {VAT_CONFIG.name}</span>
                  </div>
                  <Switch
                    checked={includeVAT}
                    onCheckedChange={setIncludeVAT}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                
                {includeVAT && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{VAT_CONFIG.name} ({VAT_CONFIG.rate}%)</span>
                    <span>${totals.tax.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">${totals.total.toFixed(2)}</span>
                </div>
                
                <Button className="w-full gradient-primary text-primary-foreground" onClick={() => { setShowCart(false); handleProceedToCheckout(); }}>
                  Proceed to Checkout
                </Button>
                <Button variant="outline" className="w-full" onClick={clearCart}>Clear Cart</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold">Hardware Shop</h1>
          <p className="text-muted-foreground text-sm mt-1">Purchase CSM devices and accessories</p>
        </div>
        <Button variant="outline" className="relative" onClick={() => setShowCart(true)}>
          <ShoppingCart className="h-4 w-4 mr-2" />
          Cart
          {cartItemCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-primary text-primary-foreground">
              {cartItemCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Bundle Offer */}
      <Card className="bg-gradient-to-r from-primary/10 to-transparent border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full"><Sparkles className="h-8 w-8 text-primary" /></div>
              <div>
                <h3 className="font-heading font-bold text-lg">Complete Bundle Deal</h3>
                <p className="text-sm text-muted-foreground">CSM FingerPrint + Card Reader + All Accessories — Save 15%</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-primary">$108</span>
                  <span className="text-sm text-muted-foreground line-through">$151</span>
                  <Badge className="bg-green-500">Save $43</Badge>
                </div>
              </div>
            </div>
            <Button onClick={handleAddBundle} className="gradient-primary text-primary-foreground">
              <Zap className="h-4 w-4 mr-2" />Add Bundle to Cart
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {HARDWARE_PRODUCTS.map((product) => (
          <Card key={product.id} className="group hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer">
            <div className="relative" onClick={() => { setSelectedProduct(product); setShowProductDialog(true); }}>
              {product.popular && <Badge className="absolute top-3 left-3 z-10 bg-primary">Most Popular</Badge>}
              {product.discount && <Badge className="absolute top-3 right-3 z-10 bg-red-500 text-white">-{product.discount}%</Badge>}
              <div className="h-48 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center rounded-t-lg">
                {product.category === "fingerprint_card" && <Smartphone className="h-24 w-24 text-primary" />}
                {product.category === "fingerprint_only" && <Fingerprint className="h-24 w-24 text-primary" />}
                {product.category === "accessories" && <Shield className="h-24 w-24 text-primary" />}
              </div>
              <CardContent className="pt-4">
                <div className="flex items-center gap-1 mb-2">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span className="text-sm font-medium">{product.rating}</span>
                  <span className="text-xs text-muted-foreground">({product.reviews})</span>
                </div>
                <h3 className="font-heading font-semibold text-lg leading-tight">{product.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">${product.price}</span>
                  {product.originalPrice && <span className="text-sm text-muted-foreground line-through">${product.originalPrice}</span>}
                </div>
                <Button className="w-full mt-4 gradient-primary" onClick={(e) => { e.stopPropagation(); addToCart(product, 1); }}>
                  <ShoppingCart className="h-4 w-4 mr-2" />Add to Cart
                </Button>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4"><MapPin className="h-8 w-8 mx-auto text-primary mb-2" /><p className="font-medium">Free Pickup</p><p className="text-xs text-muted-foreground">From Kigali office</p></div>
        <div className="text-center p-4"><Truck className="h-8 w-8 mx-auto text-primary mb-2" /><p className="font-medium">Fast Delivery</p><p className="text-xs text-muted-foreground">Nationwide shipping</p></div>
        <div className="text-center p-4"><RotateCcw className="h-8 w-8 mx-auto text-primary mb-2" /><p className="font-medium">30-Day Returns</p><p className="text-xs text-muted-foreground">Hassle-free</p></div>
        <div className="text-center p-4"><Shield className="h-8 w-8 mx-auto text-primary mb-2" /><p className="font-medium">1-Year Warranty</p><p className="text-xs text-muted-foreground">On all devices</p></div>
      </div>

      {/* Bulk Order Section */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-heading font-bold text-lg">Bulk Orders for Institutions</h3>
              <p className="text-sm text-muted-foreground">
                Get special pricing for orders of 10+ devices. Contact our sales team.
              </p>
            </div>
            <Button variant="outline">
              <Mail className="h-4 w-4 mr-2" />
              Request Quote
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Product Detail Dialog */}
      <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader><DialogTitle className="text-xl font-heading">{selectedProduct.name}</DialogTitle></DialogHeader>
              <Tabs defaultValue="details" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="specs">Specifications</TabsTrigger>
                  <TabsTrigger value="shipping">Delivery Info</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 pt-4">
                  <p>{selectedProduct.description}</p>
                  <div><h4 className="font-semibold mb-2">Key Features</h4><ul className="space-y-1">{selectedProduct.features.map((f, i) => (<li key={i} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" />{f}</li>))}</ul></div>
                </TabsContent>
                <TabsContent value="specs" className="pt-4"><div className="space-y-2">{Object.entries(selectedProduct.specifications).map(([k, v]) => (<div key={k} className="flex justify-between py-2 border-b"><span className="font-medium">{k}</span><span className="text-muted-foreground">{v}</span></div>))}</div></TabsContent>
                <TabsContent value="shipping" className="pt-4 space-y-4">
                  <div className="p-3 rounded-lg bg-muted/30"><Store className="h-5 w-5 text-primary mb-2" /><p className="font-medium">Free Self Pickup</p><p className="text-sm">Pick up from our Kigali office. Ready in 1-2 hours.</p></div>
                  <div className="p-3 rounded-lg bg-muted/30"><Truck className="h-5 w-5 text-primary mb-2" /><p className="font-medium">Home Delivery</p><p className="text-sm">Standard delivery: $5 (2-3 days), Express: $15 (next day)</p></div>
                </TabsContent>
              </Tabs>
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div><p className="text-2xl font-bold text-primary">${selectedProduct.price}</p>{selectedProduct.originalPrice && <p className="text-sm text-muted-foreground line-through">${selectedProduct.originalPrice}</p>}</div>
                <div className="flex gap-3"><Button variant="outline" onClick={() => setShowProductDialog(false)}>Close</Button><Button className="gradient-primary" onClick={() => { addToCart(selectedProduct, 1); setShowProductDialog(false); }}>Add to Cart</Button></div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main export wrapped with Elements
export default function App() {
  return (
    <Elements stripe={stripePromise}>
      <HardwareShop />
    </Elements>
  );
}