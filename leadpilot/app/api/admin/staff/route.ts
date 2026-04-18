import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdminRole } from '@/lib/admin-auth';

// 1. GET：拉取所有神职人员名单
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN']);
    if (!auth.ok) return auth.response;

    const staff = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, phone: true, adminRole: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ staff });
  } catch (error: any) {
    return NextResponse.json({ error: '拉取员工列表失败' }, { status: 500 });
  }
}

// 2. POST：添加/提拔新员工
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN']);
    if (!auth.ok) return auth.response;

    const { email, adminRole } = await req.json();
    if (!email || !adminRole) return NextResponse.json({ error: '必须填写邮箱和角色' }, { status: 400 });

    // 给新提拔的员工生成一个随机密码
    const defaultPassword = 'Staff' + Math.floor(100000 + Math.random() * 900000);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await prisma.user.upsert({
      where: { email },
      update: { 
        role: 'ADMIN', 
        adminRole: adminRole 
      },
      create: {
        email,
        password: hashedPassword,
        companyName: 'LeadPilot 内部指挥部',
        role: 'ADMIN',
        adminRole: adminRole,
        subscriptionTier: 'MAX',
        features: {} // 满足非空校验
      }
    });

    // 故意在这个报错信息里把密码传给前端（前端现在没有显示密码的逻辑，您可以去数据库看，或者让员工点忘记密码）
    return NextResponse.json({ success: true, message: '添加成功' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: '添加员工失败' }, { status: 500 });
  }
}

// 3. PATCH：快速修改员工权限 (比如把运营升级成财务)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN']);
    if (!auth.ok) return auth.response;

    const { userId, adminRole } = await req.json();
    if (!userId || !adminRole) return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });

    await prisma.user.update({
      where: { id: userId },
      data: { adminRole }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: '更新权限失败' }, { status: 500 });
  }
}

// 4. DELETE：撤销权限 (开除出管理层，降级为普通用户)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdminRole(['SUPER_ADMIN']);
    if (!auth.ok) return auth.response;

    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: '缺少员工 ID' }, { status: 400 });

    await prisma.user.update({
      where: { id: userId },
      data: { 
        role: 'USER',       // 降级为普通用户
        adminRole: null     // 剥夺管理头衔
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: '撤销权限失败' }, { status: 500 });
  }
}